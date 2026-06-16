// ============================================================
//  PMax Insights — MCC Script (Agency Multi-Client Version)
//  Writes ALL MCC-linked client accounts into ONE central Sheet
//  Safe to run alongside single_account_script.js on external
//  accounts — targeted row deletion by account_id, no overwrites
// ============================================================

function main() {

  // ─── CONFIG ──────────────────────────────────────────────
  const SHEET_URL   = 'https://docs.google.com/spreadsheets/d/1pADqa7-Shz0H1lUyQ8658TfN4sA6f_3ymn-BY3G5JLg/edit';
  const ZOMBIE_DAYS = 366;
  const PROD_DAYS   = 181;
  const MAIN_DAYS   = 180;  // primary window: campaigns, channel split, asset groups, 30-day product table

  // Exact account names to skip (case-sensitive)
  const BLOCKLIST = [
    // 'Test Account',
    // 'Paused Client',
  ];

  // Block by account ID instead (safer — names can change)
  const BLOCKLIST_IDS = [
    // '123-456-7890',
  ];
  // ─────────────────────────────────────────────────────────

  const ss = SpreadsheetApp.openByUrl(SHEET_URL);
  const accountIterator = MccApp.accounts().get();

  while (accountIterator.hasNext()) {
    const account     = accountIterator.next();
    const accountName = account.getName();
    const accountId   = account.getCustomerId();

    if (BLOCKLIST.includes(accountName) || BLOCKLIST_IDS.includes(accountId)) {
      Logger.log('SKIPPED (blocklist): ' + accountName + ' (' + accountId + ')');
      continue;
    }

    Logger.log('Processing: ' + accountName + ' (' + accountId + ')');
    MccApp.select(account);

    clearAccountRows(ss, accountId);

    try {
      runForAccount(ss, accountName, accountId, ZOMBIE_DAYS, PROD_DAYS, MAIN_DAYS);
      Logger.log('Done: ' + accountName);
    } catch(e) {
      Logger.log('ERROR on ' + accountName + ': ' + e.message);
    }
  }

  Logger.log('All accounts processed.');
}


function runForAccount(ss, accountName, accountId, zombieDays, prodDays, mainDays) {

  const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
  const now      = new Date();
  const timeZone = AdsApp.currentAccount().getTimeZone();
  const to       = new Date(now.getTime() - 1 * MILLIS_PER_DAY);
  const from366  = new Date(now.getTime() - zombieDays * MILLIS_PER_DAY);
  const from181  = new Date(now.getTime() - prodDays * MILLIS_PER_DAY);
  const fromMain = new Date(now.getTime() - mainDays * MILLIS_PER_DAY);
  const fmt      = function(d) { return Utilities.formatDate(d, timeZone, 'yyyy-MM-dd'); };

  const dateMain    = ' segments.date BETWEEN "' + fmt(fromMain) + '" AND "' + fmt(to) + '"';
  const zombieRange = ' segments.date BETWEEN "' + fmt(from366) + '" AND "' + fmt(to) + '"';
  const prodDate    = ' segments.date BETWEEN "' + fmt(from181) + '" AND "' + fmt(to) + '"';
  const pMaxOnly    = ' AND campaign.advertising_channel_type = "PERFORMANCE_MAX" ';
  const agFilter    = ' AND asset_group_listing_group_filter.type != "SUBDIVISION" ';
  const notInter    = ' AND segments.asset_interaction_target.interaction_on_this_asset != "TRUE" ';
  const order       = ' ORDER BY campaign.name ';
  const orderImpr   = ' ORDER BY metrics.impressions DESC ';

  const queries = {
    r_camp: 'SELECT segments.date, campaign.name, metrics.cost_micros, metrics.conversions,' +
            'metrics.conversions_value, metrics.impressions, metrics.clicks,' +
            'campaign.advertising_channel_type' +
            ' FROM campaign WHERE' + dateMain + pMaxOnly + order,

    r_dv: 'SELECT segments.date, campaign.name, segments.asset_interaction_target.asset,' +
          'metrics.cost_micros, metrics.conversions, metrics.conversions_value,' +
          'metrics.impressions, campaign.advertising_channel_type,' +
          'segments.asset_interaction_target.interaction_on_this_asset' +
          ' FROM campaign WHERE' + dateMain + pMaxOnly + notInter + order,

    r_prod_t: 'SELECT campaign.name, segments.product_title, metrics.cost_micros,' +
              'metrics.conversions, metrics.conversions_value, metrics.impressions,' +
              'campaign.advertising_channel_type, segments.product_item_id,' +
              'segments.product_custom_attribute0, segments.product_custom_attribute1,' +
              'segments.product_custom_attribute2, segments.product_custom_attribute3,' +
              'segments.product_custom_attribute4' +
              ' FROM shopping_performance_view WHERE' + dateMain + pMaxOnly + order,

    r_ag: 'SELECT segments.date, campaign.name, asset_group.name, asset_group.ad_strength,' +
          'asset_group.status, asset_group_listing_group_filter.type,' +
          'metrics.impressions, metrics.clicks, metrics.cost_micros,' +
          'metrics.conversions, metrics.conversions_value' +
          ' FROM asset_group_product_group_view WHERE' + dateMain + agFilter,

    r_allads: 'SELECT asset.id, asset.final_urls, asset.source, asset.type,' +
              'asset.youtube_video_asset.youtube_video_title,' +
              'asset.youtube_video_asset.youtube_video_id,' +
              'asset.text_asset.text, asset.resource_name, asset.name' +
              ' FROM asset',

    zombies: 'SELECT segments.product_item_id, metrics.clicks, metrics.impressions,' +
             'segments.product_title' +
             ' FROM shopping_performance_view' +
             ' WHERE metrics.clicks < 1 AND' + zombieRange + orderImpr
  };

  Object.keys(queries).forEach(function(tabName) {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) { Logger.log('Tab not found: ' + tabName); return; }
    appendReport(queries[tabName], sheet, accountName, accountId);
  });
}


// Remove only rows belonging to this account_id — bulk, in place.
// Reads each tab once, keeps the header + every other account's rows,
// rewrites them in a single setValues, then clears only the stale tail.
// This replaces the old row-by-row deleteRow loop (one API call per row),
// which was extremely slow for accounts with many rows.
function clearAccountRows(ss, accountId) {
  const tabs = ['r_camp','r_dv','r_prod_t','r_prod_t_180','r_ag','r_allads','r_ads','zombies'];
  tabs.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;

    const data     = sh.getDataRange().getValues();
    const header   = data[0];
    const accIdCol = header.indexOf('account_id');
    if (accIdCol === -1) return;

    // Keep header + every row that does NOT belong to this account
    const kept = [header];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][accIdCol]) !== String(accountId)) kept.push(data[i]);
    }
    if (kept.length === data.length) return; // this account had no rows here

    const numCols = header.length;
    // Overwrite from row 1 with the rows we are keeping (1 bulk write)
    sh.getRange(1, 1, kept.length, numCols).setValues(kept);
    // Clear only the now-stale trailing rows (1 bulk clear)
    const leftover = data.length - kept.length;
    if (leftover > 0) sh.getRange(kept.length + 1, 1, leftover, numCols).clearContent();
  });
}

function appendReport(query, sheet, accountName, accountId) {
  const report  = AdsApp.report(query);
  const rows    = report.rows();
  const data    = [];
  let   isFirst = (sheet.getLastRow() === 0);

  while (rows.hasNext()) {
    const row = rows.next();
    if (isFirst) {
      data.push(['account_name', 'account_id'].concat(Object.keys(row)));
      isFirst = false;
    }
    data.push([accountName, accountId].concat(Object.values(row)));
  }

  if (data.length === 0) return;
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
}

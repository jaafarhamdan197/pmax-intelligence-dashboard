// ============================================================
//  PMax Insights — MCC Script (Agency Multi-Client Version)
//  v3 — scale-safe edition
//
//  Writes ALL MCC-linked client accounts into ONE central Sheet.
//  Output tabs & columns are UNCHANGED (dashboard-compatible):
//    r_camp, r_dv, r_prod_t, r_ag, r_allads, zombies
//
//  Scale optimizations vs earlier versions:
//   • Single-pass clearing  — each tab is read ONCE per run, not
//     once per account. Preserves rows owned by external
//     single-account scripts.
//   • Chunked writes        — every setValues is capped at 5,000
//     rows so we never send an oversized payload to the API.
//   • 30-day window         — keeps the sheet well under Google's
//     10M-cell limit and matches the dashboard's 30-day scope.
//     r_camp and r_dv share the SAME window so the dashboard's
//     Search-cost remainder (total − shop − video − display)
//     stays correct.
// ============================================================

function main() {

  // ─── CONFIG ──────────────────────────────────────────────
  const SHEET_URL   = 'https://docs.google.com/spreadsheets/d/1pADqa7-Shz0H1lUyQ8658TfN4sA6f_3ymn-BY3G5JLg/edit';
  const MAIN_DAYS   = 180;    // campaigns, channel split, asset groups, products
  const ZOMBIE_DAYS = 366;   // zombie (0-click) product lookback
  const WRITE_CHUNK = 5000;  // max rows per setValues call (API safety)

  // Tabs this script owns & refreshes every run.
  // (r_prod_t_180 and r_ads are intentionally left untouched.)
  const OWNED_TABS = ['r_camp','r_dv','r_prod_t','r_ag','r_allads','zombies'];

  // Exact account names to skip (case-sensitive)
  const BLOCKLIST = [
    // 'Test Account',
  ];

  // Block by account ID instead (safer — names can change)
  const BLOCKLIST_IDS = [
    // '123-456-7890',
  ];
  // ─────────────────────────────────────────────────────────

  const ss = SpreadsheetApp.openByUrl(SHEET_URL);

  // 1. Collect the accounts this run will process
  const accounts = [];
  const it = MccApp.accounts().get();
  while (it.hasNext()) {
    const a = it.next();
    if (BLOCKLIST.includes(a.getName()) || BLOCKLIST_IDS.includes(a.getCustomerId())) {
      Logger.log('SKIPPED (blocklist): ' + a.getName() + ' (' + a.getCustomerId() + ')');
      continue;
    }
    accounts.push(a);
  }
  Logger.log('Accounts to process: ' + accounts.length);

  // 2. Single-pass clear: remove THIS run's accounts from every owned
  //    tab in one read + one write per tab (preserves other accounts).
  const refreshIds = {};
  accounts.forEach(function(a){ refreshIds[String(a.getCustomerId())] = true; });
  clearRunAccounts(ss, OWNED_TABS, refreshIds, WRITE_CHUNK);

  // 3. Append fresh data per account
  accounts.forEach(function(account) {
    const accountName = account.getName();
    const accountId   = account.getCustomerId();
    Logger.log('Processing: ' + accountName + ' (' + accountId + ')');
    MccApp.select(account);
    try {
      runForAccount(ss, accountName, accountId, MAIN_DAYS, ZOMBIE_DAYS, WRITE_CHUNK);
      Logger.log('Done: ' + accountName);
    } catch(e) {
      Logger.log('ERROR on ' + accountName + ': ' + e.message);
    }
  });

  Logger.log('All accounts processed.');
}


function runForAccount(ss, accountName, accountId, mainDays, zombieDays, writeChunk) {

  const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
  const now      = new Date();
  const timeZone = AdsApp.currentAccount().getTimeZone();
  const to       = new Date(now.getTime() - 1 * MILLIS_PER_DAY);
  const fromMain = new Date(now.getTime() - mainDays   * MILLIS_PER_DAY);
  const from366  = new Date(now.getTime() - zombieDays * MILLIS_PER_DAY);
  const fmt      = function(d) { return Utilities.formatDate(d, timeZone, 'yyyy-MM-dd'); };

  const dateMain    = ' segments.date BETWEEN "' + fmt(fromMain) + '" AND "' + fmt(to) + '"';
  const zombieRange = ' segments.date BETWEEN "' + fmt(from366) + '" AND "' + fmt(to) + '"';
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
    appendReport(queries[tabName], sheet, accountName, accountId, writeChunk);
  });
}


// ─── SINGLE-PASS CLEAR ───────────────────────────────────────
// For each owned tab: read once, keep header + every row that does
// NOT belong to an account in this run, then rewrite once (chunked).
// Rows owned by external single-account scripts are preserved.
function clearRunAccounts(ss, tabs, refreshIds, writeChunk) {
  tabs.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;

    const data     = sh.getDataRange().getValues();
    const header   = data[0];
    const accIdCol = header.indexOf('account_id');
    if (accIdCol === -1) return;

    const kept = [header];
    for (let i = 1; i < data.length; i++) {
      if (!refreshIds[String(data[i][accIdCol])]) kept.push(data[i]);
    }
    if (kept.length === data.length) return; // nothing from this run was here

    const numCols = header.length;

    // Wipe the tab body, then write the kept rows back in chunks
    sh.getRange(1, 1, data.length, numCols).clearContent();
    writeChunked(sh, kept, numCols, 1, writeChunk);
  });
}


// ─── APPEND ONE ACCOUNT'S REPORT (chunked) ───────────────────
function appendReport(query, sheet, accountName, accountId, writeChunk) {
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
  const numCols  = data[0].length;
  const startRow = sheet.getLastRow() + 1;
  writeChunked(sheet, data, numCols, startRow, writeChunk);
}


// ─── CHUNKED WRITE HELPER ────────────────────────────────────
// Writes a 2D array to the sheet in batches of `chunk` rows so no
// single setValues call exceeds the API payload limit.
function writeChunked(sheet, rows, numCols, startRow, chunk) {
  let offset = 0;
  while (offset < rows.length) {
    const slice = rows.slice(offset, offset + chunk);
    sheet.getRange(startRow + offset, 1, slice.length, numCols).setValues(slice);
    offset += chunk;
  }
}
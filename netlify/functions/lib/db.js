'use strict';
/**
 * Dynamic database connection manager for RIPU26 using Google Sheets.
 * Supports 3 completely independent Google Sheets (via Google Apps Script Web Apps).
 *
 * ENV variables required:
 * - GS_URL_FORM1
 * - GS_URL_FORM2
 * - GS_URL_FORM3
 */

function getDbConfig(formOrView) {
  let form = 1;
  if (typeof formOrView === 'number') {
    form = formOrView;
  } else if (typeof formOrView === 'string') {
    const v = formOrView.toLowerCase();
    if (['arrivees', 'accueil', 'jour', 'tranche', 'vol', '2'].includes(v)) {
      form = 2;
    } else if (['excursion', 'totaux', '3'].includes(v)) {
      form = 3;
    } else {
      form = 1; // participants, stats, default
    }
  }

  const url = process.env[`GS_URL_FORM${form}`];

  return { url, form };
}

module.exports = { getDbConfig };

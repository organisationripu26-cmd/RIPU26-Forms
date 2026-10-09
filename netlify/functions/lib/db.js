'use strict';
/**
 * Dynamic database connection manager for RIPU26.
 * Supports both:
 * 1. Multi-DB Mode (3 truly distinct databases):
 *    - DB1: SUPABASE_URL_FORM1 / SUPABASE_SERVICE_KEY_FORM1
 *    - DB2: SUPABASE_URL_FORM2 / SUPABASE_SERVICE_KEY_FORM2
 *    - DB3: SUPABASE_URL_FORM3 / SUPABASE_SERVICE_KEY_FORM3
 * 2. Single DB Fallback Mode:
 *    - SUPABASE_URL / SUPABASE_SERVICE_KEY
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

  const specificUrl = process.env[`SUPABASE_URL_FORM${form}`];
  const specificKey = process.env[`SUPABASE_SERVICE_KEY_FORM${form}`];

  const url = specificUrl || process.env.SUPABASE_URL;
  const key = specificKey || process.env.SUPABASE_SERVICE_KEY;

  const isMultiDb = !!(process.env.SUPABASE_URL_FORM1 || process.env.SUPABASE_URL_FORM2 || process.env.SUPABASE_URL_FORM3);

  return { url, key, form, isMultiDb };
}

module.exports = { getDbConfig };

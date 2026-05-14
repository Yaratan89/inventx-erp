import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: parties } = await supabase.from('parties').select('*').ilike('name', '%Lundbergfarm%');
  console.log("Parties found:", parties);
  
  if (!parties || parties.length === 0) {
     console.log("No party found.");
     return;
  }
  const partyId = parties[0].id;
  console.log("Party ID:", partyId);

  // Check stock documents
  const { data: docs } = await supabase.from('stock_documents').select('*').eq('party_id', partyId);
  console.log("Stock documents for party:", docs ? docs.length : 0);
  if (docs && docs.length > 0) {
      console.log("Docs details:", docs.map(d => ({ no: d.document_no, type: d.document_type, total: d.total_amount, status: d.status, items: d.items })));
  }

  // Check existing financial transactions
  const { data: txs } = await supabase.from('financial_transactions').select('*').eq('party_id', partyId);
  console.log("Existing financial transactions:", txs ? txs.length : 0);
  if (txs && txs.length > 0) {
      console.log("Txs:", txs.map(t => ({ amount: t.amount, desc: t.description, type: t.type })));
  }
}
check();

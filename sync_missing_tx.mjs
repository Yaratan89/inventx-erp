import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sync() {
  const { data: docs } = await supabase.from('stock_documents').select('*').eq('status', 'COMPLETED');
  const { data: txs } = await supabase.from('financial_transactions').select('*');
  
  if (!docs) return;

  let syncedCount = 0;
  for (const doc of docs) {
     if (doc.party_id && doc.total_amount > 0) {
        // Check if transaction exists
        const txExists = txs.some(t => t.description && t.description.includes(`No: ${doc.document_no}`));
        
        if (!txExists) {
            console.log(`Missing transaction for doc: ${doc.document_no}, Amount: ${doc.total_amount}`);
            
            const type = doc.document_type === 'IN' ? 'Purchase_Debt' : 'Sale_Credit';
            const itemsLength = Array.isArray(doc.items) ? doc.items.length : (typeof doc.items === 'string' ? JSON.parse(doc.items).length : 1);
            const desc = `Toplu ${doc.document_type === 'IN' ? 'Alım' : 'Satış'} - ${itemsLength} kalem. No: ${doc.document_no}`;
            
            const { error } = await supabase.from('financial_transactions').insert([{
               party_id: doc.party_id,
               amount: doc.total_amount,
               type: type,
               method: 'Cash',
               description: desc,
               created_at: doc.created_at
            }]);
            
            if (error) {
               console.error(`Failed to insert for ${doc.document_no}:`, error);
            } else {
               console.log(`Successfully synced ${doc.document_no}`);
               syncedCount++;
            }
        }
     }
  }
  console.log(`Sync completed. Added ${syncedCount} missing transactions.`);
}

sync();

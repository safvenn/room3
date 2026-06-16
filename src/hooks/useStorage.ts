import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseStorageReturn {
  uploadReceipt: (
    transactionId: string,
    userId: string,
    file: File
  ) => Promise<{ path: string | null; error: string | null }>;
  getReceiptUrl: (storagePath: string) => string;
  deleteReceipt: (
    attachmentId: string,
    storagePath: string,
    userId: string
  ) => Promise<{ error: string | null }>;
}

export function useStorage(): UseStorageReturn {
  const uploadReceipt = useCallback(
    async (
      transactionId: string,
      userId: string,
      file: File
    ): Promise<{ path: string | null; error: string | null }> => {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const storagePath = `${userId}/${transactionId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, file, { upsert: false });

      if (uploadError) return { path: null, error: uploadError.message };

      // Save the attachment record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await supabase.from('receipt_attachments').insert({
        transaction_id: transactionId,
        user_id: userId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
      } as any);

      if (dbError) {
        // Rollback the file upload
        await supabase.storage.from('receipts').remove([storagePath]);
        return { path: null, error: dbError.message };
      }

      return { path: storagePath, error: null };
    },
    []
  );

  const getReceiptUrl = useCallback((storagePath: string): string => {
    const { data } = supabase.storage.from('receipts').getPublicUrl(storagePath);
    return data.publicUrl;
  }, []);

  const deleteReceipt = useCallback(
    async (
      attachmentId: string,
      storagePath: string,
      userId: string
    ): Promise<{ error: string | null }> => {
      // Delete DB record first
      const { error: dbError } = await supabase
        .from('receipt_attachments')
        .delete()
        .eq('id', attachmentId)
        .eq('user_id', userId);

      if (dbError) return { error: dbError.message };

      // Then remove from storage
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([storagePath]);

      if (storageError) return { error: storageError.message };
      return { error: null };
    },
    []
  );

  return { uploadReceipt, getReceiptUrl, deleteReceipt };
}

import writeXlsxFile from 'write-excel-file/browser';
import { saveAs } from 'file-saver';

/**
 * Exports chat messages to a `messages.xlsx` file download.
 *
 * Messages without content are filtered out, then a two-column sheet
 * (Message Type / Content) is written and handed to the browser as a
 * download. Shared by the recent- and pinned-message sidebars.
 */
export const exportMessagesToXlsx = async (messages: any) => {
  try {
    const data = messages.filter((item: any) => item?.message?.data?.content);
    const blob = await writeXlsxFile(data, {
      sheet: 'Messages',
      columns: [
        {
          header: 'Message Type',
          cell: (message: any) => message?.message?.data?.type,
        },
        {
          header: 'Content',
          cell: (message: any) => message?.message?.data?.content,
        },
      ],
    }).toBlob();
    saveAs(blob, 'messages.xlsx');
  } catch (err) {
    console.error('Failed to export messages: ', err);
  }
};

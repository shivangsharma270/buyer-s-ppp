import Papa from 'papaparse';

export interface SourceOfVisitData {
  date: string;
  buyerGlid: string;
  source: string;
  typeOfIssue: string;
  pppApplicable: string;
  ticketId: string;
  ticketStage: string;
}

const SOURCE_OF_VISIT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/11Uz1ZKM3Kzu0-Wt_Uw5k0kODwR9vrotPazo2irtZwWY/export?format=csv&gid=1875412395';

export async function fetchSourceOfVisitData(): Promise<SourceOfVisitData[]> {
  try {
    const response = await fetch(SOURCE_OF_VISIT_SHEET_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(), // Trim headers to avoid space issues
        complete: (results) => {
          const data = results.data.map((row: any) => {
            // Find keys case-insensitively if needed, but sticking to exact names first
            const date = (row['Date'] || '').trim();
            const rawGlid = (row['Buyer GLID (Not Set = unidentified)'] || '').trim();
            const source = (row['Source'] || '').trim();
            const typeOfIssue = (row['Type of Issue'] || '').trim();
            const pppApplicable = (row['PPP Applicable'] || '').trim();
            const ticketId = (row['Ticket ID'] || '').trim();
            const ticketStage = (row['Ticket Stage'] || '').trim();
            
            return {
              date: date,
              buyerGlid: rawGlid,
              source: source,
              typeOfIssue: typeOfIssue,
              pppApplicable: pppApplicable,
              ticketId: ticketId,
              ticketStage: ticketStage,
            };
          });
          resolve(data);
        },
        error: (error: any) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

import Papa from 'papaparse';

export interface SourceOfVisitData {
  date: string;
  buyerGlid: string;
  source: string;
  typeOfIssue: string;
  pppApplicable: string;
  ticketId: string;
  ticketStage: string;
  visitCount: number;
}

export interface TSDataBifurcationRow {
  id: string;
  issueDate: string;
  closeDate: string;
  buyerGlid: string;
  againstSellerGlid: string;
  sellerCusttype: string;
  typeOfIssue: string;
  lastUpdated: string;
  pppStatus: string;
  ticketStage: string;
  closingComment: string;
}

export interface TSClosedTicketsRow {
  ticketId: string;
  issueDate: string;
  closeDate: string;
  buyerGlid: string;
  againstSellerGlid: string;
  sellerCusttype: string;
  typeOfIssue: string;
  lastUpdated: string;
  pppStatus: string;
  ticketStage: string;
  closingComment: string;
}

export interface PPPInScopeRow {
  ticketId: string;
  buyerGlid: string;
  buyerName: string;
  buyerCity: string;
  sellerGlid: string;
  companyName: string;
  custType: string;
  city: string;
  refundStatus: string;
  disputeAmount: string;
  caseStudyThread: string;
  caseStudySharedDate: string;
  [key: string]: string;
}

const SOURCE_OF_VISIT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/11Uz1ZKM3Kzu0-Wt_Uw5k0kODwR9vrotPazo2irtZwWY/export?format=csv&gid=1875412395';
const TS_DATA_BIFURCATION_SHEET_URL = 'https://docs.google.com/spreadsheets/d/11Uz1ZKM3Kzu0-Wt_Uw5k0kODwR9vrotPazo2irtZwWY/export?format=csv&gid=169733764';
const TS_CLOSED_TICKETS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/11Uz1ZKM3Kzu0-Wt_Uw5k0kODwR9vrotPazo2irtZwWY/export?format=csv&gid=1707711547';
const PPP_IN_SCOPE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/11Uz1ZKM3Kzu0-Wt_Uw5k0kODwR9vrotPazo2irtZwWY/export?format=csv&gid=574816043';

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
            
            // Try multiple possible column names for Visit Count
            let visitCountRaw = '';
            const possibleVisitCountKeys = ['Visit Count', 'visit count', 'Visit count', 'visit Count', 'Visits', 'visits', 'Count', 'count'];
            for (const key of possibleVisitCountKeys) {
              if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                visitCountRaw = (row[key] || '').toString().trim();
                break;
              }
            }
            
            // More robust parsing of visit count
            let visitCount = 0;
            if (visitCountRaw) {
              const parsed = parseFloat(visitCountRaw);
              if (!isNaN(parsed)) {
                visitCount = parsed;
              }
            }
            console.log('Final visitCount:', visitCount);
            
            return {
              date: date,
              buyerGlid: rawGlid,
              source: source,
              typeOfIssue: typeOfIssue,
              pppApplicable: pppApplicable,
              ticketId: ticketId,
              ticketStage: ticketStage,
              visitCount: visitCount,
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

export async function fetchTSDataBifurcation(): Promise<TSDataBifurcationRow[]> {
  try {
    const response = await fetch(TS_DATA_BIFURCATION_SHEET_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          const data = results.data.map((row: any) => {
            return {
              id: (row['ID'] || row['Ticket ID'] || '').trim(),
              issueDate: (row['Issue Date'] || '').trim(),
              closeDate: (row['Close date'] || '').trim(),
              buyerGlid: (row['Buyer GLID'] || '').trim(),
              againstSellerGlid: (row['Against Seller GLID'] || '').trim(),
              sellerCusttype: (row['Seller Custtype'] || '').trim(),
              typeOfIssue: (row['Type of Issue'] || '').trim(),
              lastUpdated: (row['Last Updated'] || '').trim(),
              pppStatus: (row['PPP Status'] || '').trim(),
              ticketStage: (row['Ticket Stage'] || '').trim(),
              closingComment: (row['Closing comment'] || '').trim(),
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
    console.error('Error fetching TS bifurcation sheet data:', error);
    throw error;
  }
}

export async function fetchPPPInScopeData(): Promise<PPPInScopeRow[]> {
  try {
    const response = await fetch(PPP_IN_SCOPE_SHEET_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          const data = results.data.map((row: any) => {
            const cleanRow: PPPInScopeRow = {
              ticketId: (row['Ticket ID'] || '').trim(),
              buyerGlid: (row['Buyer GLID'] || '').trim(),
              buyerName: (row['Buyer Name'] || '').trim(),
              buyerCity: (row['Buyer City'] || '').trim(),
              sellerGlid: (row['Seller GLID'] || '').trim(),
              companyName: (row['Company Name'] || '').trim(),
              custType: (row['Cust-type'] || '').trim(),
              city: (row['City'] || '').trim(),
              refundStatus: (row['Refund Status'] || '').trim(),
              disputeAmount: (row['Dispute Amount'] || '').trim(),
              caseStudyThread: (row['Case Study Thread'] || '').trim(),
              caseStudySharedDate: (row['Case Study Shared Date'] || '').trim(),
            };
            // Store all other columns for modal display
            Object.keys(row).forEach(key => {
              const trimmedKey = key.trim();
              cleanRow[trimmedKey] = (row[key] || '').trim();
            });
            return cleanRow;
          });
          resolve(data);
        },
        error: (error: any) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching PPP In Scope sheet data:', error);
    throw error;
  }
}

export async function fetchTSClosedTicketsData(): Promise<TSClosedTicketsRow[]> {
  try {
    const response = await fetch(TS_CLOSED_TICKETS_SHEET_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          const data = results.data.map((row: any) => ({
            ticketId: (row['Ticket ID'] || '').trim(),
            issueDate: (row['Issue Date'] || '').trim(),
            closeDate: (row['Close date'] || '').trim(),
            buyerGlid: (row['Buyer GLID'] || '').trim(),
            againstSellerGlid: (row['Against Seller GLID'] || '').trim(),
            sellerCusttype: (row['Seller Custtype'] || '').trim(),
            typeOfIssue: (row['Type of Issue'] || '').trim(),
            lastUpdated: (row['Last Updated'] || '').trim(),
            pppStatus: (row['PPP Status'] || '').trim(),
            ticketStage: (row['Ticket Stage'] || '').trim(),
            closingComment: (row['Closing comment'] || '').trim(),
          }));
          resolve(data);
        },
        error: (error: any) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching TS Closed Tickets sheet data:', error);
    throw error;
  }
}

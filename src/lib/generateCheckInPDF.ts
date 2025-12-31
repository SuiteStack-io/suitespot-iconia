import jsPDF from 'jspdf';

interface CheckInData {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  unitName: string;
  checkInDate: string;
  checkOutDate: string;
  signatureDataUrl: string;
  signedAt: Date;
}

// Load and register Playfair Display fonts (Regular and Bold) for jsPDF from local files
const loadPlayfairFonts = async (pdf: jsPDF): Promise<boolean> => {
  try {
    // Load Regular variant
    const regularResponse = await fetch('/fonts/PlayfairDisplay-Regular.ttf');
    if (!regularResponse.ok) throw new Error('Regular font fetch failed');
    const regularBuffer = await regularResponse.arrayBuffer();
    const regularBase64 = btoa(
      new Uint8Array(regularBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    pdf.addFileToVFS('PlayfairDisplay-Regular.ttf', regularBase64);
    pdf.addFont('PlayfairDisplay-Regular.ttf', 'PlayfairDisplay', 'normal');

    // Load Bold variant
    const boldResponse = await fetch('/fonts/PlayfairDisplay-Bold.ttf');
    if (!boldResponse.ok) throw new Error('Bold font fetch failed');
    const boldBuffer = await boldResponse.arrayBuffer();
    const boldBase64 = btoa(
      new Uint8Array(boldBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    pdf.addFileToVFS('PlayfairDisplay-Bold.ttf', boldBase64);
    pdf.addFont('PlayfairDisplay-Bold.ttf', 'PlayfairDisplay', 'bold');

    return true;
  } catch (error) {
    console.error('Failed to load Playfair Display fonts, using fallback:', error);
    return false;
  }
};

export const generateCheckInPDF = async (data: CheckInData): Promise<Blob> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Load Playfair Display fonts (Regular and Bold) - returns true if successful
  const playfairLoaded = await loadPlayfairFonts(pdf);
  
  // Helper to set header font with fallback (normal weight)
  const setHeaderFont = (bold: boolean = false) => {
    if (playfairLoaded) {
      pdf.setFont('PlayfairDisplay', bold ? 'bold' : 'normal');
    } else {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    }
  };
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 15; // Moved up from 20 to give more room

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 6): number => {
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // Add SuiteSpot Logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/suitespot-logo-3.png';
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
    });
    
    // Create canvas to convert image to base64
    const canvas = document.createElement('canvas');
    canvas.width = logoImg.width;
    canvas.height = logoImg.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(logoImg, 0, 0);
      const logoDataUrl = canvas.toDataURL('image/png');
      // Add logo centered at top (15mm x 15mm - reduced by 50% for better UI)
      const logoSize = 15;
      pdf.addImage(logoDataUrl, 'PNG', pageWidth / 2 - logoSize / 2, yPos, logoSize, logoSize);
      yPos += logoSize + 8; // Logo height + increased spacing before heading
    }
  } catch (error) {
    console.error('Failed to add logo:', error);
    yPos += 5;
  }

  // Header - SuiteSpot ICONIA (Playfair Display Bold)
  pdf.setFontSize(24);
  setHeaderFont(true); // Bold
  pdf.text('SuiteSpot ICONIA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Subheader - Guest Check-In Agreement (Playfair Display Regular)
  pdf.setFontSize(14);
  setHeaderFont(false); // Regular
  pdf.text('Guest Check-In Agreement', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Form Date (auto-generated) - Playfair Display Regular (~14px)
  pdf.setFontSize(11); // ~14px equivalent in PDF
  setHeaderFont(false); // Playfair Display Regular
  const formDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  pdf.text(`Form Date: ${formDate}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 5;

  // Divider line
  pdf.setDrawColor(200);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Guest Information
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Guest Information', margin, yPos);
  yPos += 8;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Full Name: ${data.guestName}`, margin, yPos);
  yPos += 6;
  pdf.text(`Phone: ${data.guestPhone}`, margin, yPos);
  yPos += 6;
  pdf.text(`Email: ${data.guestEmail}`, margin, yPos);
  yPos += 10;

  // Reservation Details
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reservation Details', margin, yPos);
  yPos += 8;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Property: ${data.unitName}`, margin, yPos);
  yPos += 10;

  // Check-in/Check-out Schedule
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Check-in/Check-out Schedule', margin, yPos);
  yPos += 8;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`a. Check-in: 3:00 PM — Date: ${data.checkInDate}`, margin, yPos);
  yPos += 6;
  pdf.text(`b. Check-out: 12:00 PM (Noon) — Date: ${data.checkOutDate}`, margin, yPos);
  yPos += 10;

  // Late Checkout Policy
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Late Checkout Policy', margin, yPos);
  yPos += 6;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Late checkout is available subject to availability.', margin, yPos);
  yPos += 6;

  pdf.setFont('helvetica', 'normal');
  yPos = addWrappedText('• Departure between 12:00 PM and 5:00 PM: An additional charge equal to 50% of the applicable nightly rate will be applied.', margin, yPos, contentWidth, 5);
  yPos += 2;
  yPos = addWrappedText('• Departure after 5:00 PM: An additional charge equal to one full night\'s rate will be applied.', margin, yPos, contentWidth, 5);
  yPos += 10;

  // Property Rules
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Property Rules', margin, yPos);
  yPos += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const rules = [
    '1. Pets: Pets are not permitted on the premises.',
    '2. Parties & Events: Parties and events are strictly prohibited within guest accommodations.',
    '3. Waste Disposal: Garbage must be disposed of in designated garbage rooms only.',
    '4. Smoking: Smoking is prohibited in all indoor areas. Designated outdoor smoking areas are available.',
    '5. Alcohol: Alcoholic beverages are not permitted in common areas.',
    '6. Prohibited Substances: Possession or use of illegal substances is strictly prohibited.',
    '7. Property Damage: Guests are responsible for any damage caused during their stay.',
    '8. Furniture: Please refrain from rearranging or relocating any furnishings.',
    '9. Liability Disclaimer: SuiteSpot ICONIA shall not be held liable for personal accidents, injuries, illness, or loss of valuables not secured in the in-room safe.',
  ];

  rules.forEach((rule) => {
    yPos = addWrappedText(rule, margin, yPos, contentWidth, 5);
    yPos += 2;
  });

  yPos += 5;

  // Force Housekeeping Section to start on Page 2
  pdf.addPage();
  yPos = 20;

  // Housekeeping Section
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Housekeeping & Guest Responsibility', margin, yPos);
  yPos += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const housekeepingPoints = [
    '• Two housekeeping visits per week are included in the rental rate.',
    '• Throughout the rental period, the Guest(s) are responsible for maintaining the property in a clean and good condition.',
    '• The Guest(s) acknowledge that the property is delivered in good condition upon arrival, except for any defects reported to the property manager no later than the end of the first day following arrival.',
    '• Any defects not reported within this timeframe shall be deemed the responsibility of the Guest(s).',
  ];

  housekeepingPoints.forEach((point) => {
    yPos = addWrappedText(point, margin, yPos, contentWidth, 5);
    yPos += 2;
  });

  yPos += 5;

  // Penalties
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  yPos = addWrappedText('A minimum penalty of $100 may be assessed, subject to the nature and extent of any damages incurred to the room.', margin, yPos, contentWidth, 5);
  yPos += 2;
  yPos = addWrappedText('A penalty of $20 will be charged for lost access keys.', margin, yPos, contentWidth, 5);
  yPos += 10;

  // Check if we need a new page for signature
  if (yPos > 230) {
    pdf.addPage();
    yPos = 20;
  }

  // Agreement Statement
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  yPos = addWrappedText('By signing below, I acknowledge and agree to abide by the above property rules. Any violation of these terms shall result in immediate termination of this rental agreement without refund.', margin, yPos, contentWidth, 5);
  yPos += 15;

  // Signature
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Signature:', margin, yPos);
  yPos += 5;

  // Add signature image
  try {
    const img = new Image();
    img.src = data.signatureDataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    pdf.addImage(data.signatureDataUrl, 'PNG', margin, yPos, 60, 25);
    yPos += 30;
  } catch (error) {
    console.error('Failed to add signature image:', error);
    yPos += 30;
  }

  // Signed date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Signed on: ${data.signedAt.toLocaleDateString()} at ${data.signedAt.toLocaleTimeString()}`, margin, yPos);
  yPos += 15;

  // Footer
  pdf.setDrawColor(200);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  pdf.setFontSize(9);
  pdf.setTextColor(128);
  pdf.text('This is a legally binding document. Please retain a copy for your records.', pageWidth / 2, yPos, { align: 'center' });

  return pdf.output('blob');
};

export const downloadCheckInPDF = async (data: CheckInData, fileName: string): Promise<void> => {
  const pdfBlob = await generateCheckInPDF(data);
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

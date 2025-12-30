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

export const generateCheckInPDF = async (data: CheckInData): Promise<Blob> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 6): number => {
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // Header
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SuiteSpot ICONIA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Guest Check-In Agreement', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

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
  yPos += 6;
  pdf.text(`Check-in Date: ${data.checkInDate}`, margin, yPos);
  yPos += 6;
  pdf.text(`Check-out Date: ${data.checkOutDate}`, margin, yPos);
  yPos += 12;

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

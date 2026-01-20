import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ItemSale {
  name: string;
  quantity: number;
  revenue: number;
  price: number;
  category: string;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

const addHeader = (doc: jsPDF, title: string) => {
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ENAITOTI HOTEL RECORDS', doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(title, doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy HH:mm')}`, doc.internal.pageSize.getWidth() / 2, 42, { align: 'center' });
  
  doc.setLineWidth(0.5);
  doc.line(20, 48, doc.internal.pageSize.getWidth() - 20, 48);
};

const addFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('powered by 4on4 tech', 20, pageHeight - 12);
    doc.text('©2025 All Rights Reserved', pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 12, { align: 'right' });
  }
};

export const generateSalesBreakdownReport = (
  items: ItemSale[],
  periodLabel: string,
  periodType: string
) => {
  const doc = new jsPDF();
  let yPosition = 55;
  
  addHeader(doc, `Sales Per Item Breakdown - ${periodLabel}`);
  
  // Summary section
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Total Revenue', formatKES(totalRevenue)],
      ['Total Items Sold', totalQuantity.toString()],
      ['Unique Items', items.length.toString()],
      ['Period', periodLabel],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });
  
  yPosition = (doc as any).lastAutoTable.finalY + 15;
  
  // Top 10 Best Sellers
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOP 10 BEST SELLERS', 20, yPosition);
  yPosition += 8;
  
  const top10 = items.slice(0, 10);
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Rank', 'Item Name', 'Category', 'Unit Price', 'Qty Sold', 'Revenue']],
    body: top10.map((item, index) => [
      `#${index + 1}`,
      item.name,
      item.category,
      formatKES(item.price),
      item.quantity.toString(),
      formatKES(item.revenue),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    margin: { left: 20, right: 20 },
    styles: { fontSize: 9 },
    didParseCell: (data) => {
      // Highlight top 3
      if (data.section === 'body' && data.row.index < 3) {
        const colors = [
          [255, 215, 0],   // Gold
          [192, 192, 192], // Silver
          [205, 127, 50],  // Bronze
        ];
        if (data.column.index === 0) {
          data.cell.styles.fillColor = colors[data.row.index] as [number, number, number];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
  
  // Full list
  if (items.length > 10) {
    doc.addPage();
    yPosition = 30;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPLETE SALES BREAKDOWN', 20, yPosition);
    yPosition += 8;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Item Name', 'Category', 'Unit Price', 'Qty Sold', 'Revenue']],
      body: items.map((item, index) => [
        (index + 1).toString(),
        item.name,
        item.category,
        formatKES(item.price),
        item.quantity.toString(),
        formatKES(item.revenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
      foot: [['', '', '', 'TOTAL:', totalQuantity.toString(), formatKES(totalRevenue)]],
      footStyles: { fillColor: [139, 92, 246], fontStyle: 'bold' },
    });
  }
  
  // Category breakdown
  const categoryMap = new Map<string, { quantity: number; revenue: number }>();
  items.forEach(item => {
    const existing = categoryMap.get(item.category);
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue += item.revenue;
    } else {
      categoryMap.set(item.category, { quantity: item.quantity, revenue: item.revenue });
    }
  });
  
  const categories = Array.from(categoryMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);
  
  if (categories.length > 0) {
    doc.addPage();
    yPosition = 30;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SALES BY CATEGORY', 20, yPosition);
    yPosition += 8;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Category', 'Items Sold', 'Revenue', '% of Total']],
      body: categories.map(cat => [
        cat.name,
        cat.quantity.toString(),
        formatKES(cat.revenue),
        `${((cat.revenue / totalRevenue) * 100).toFixed(1)}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 20, right: 20 },
      foot: [['TOTAL', totalQuantity.toString(), formatKES(totalRevenue), '100%']],
      footStyles: { fillColor: [249, 115, 22], fontStyle: 'bold' },
    });
  }
  
  addFooter(doc);
  doc.save(`Enaitoti_Sales_Breakdown_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

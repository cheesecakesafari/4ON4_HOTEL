import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

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

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

// Interfaces
interface DailySummary {
  totalRevenue: number;
  totalExpenses: number;
  totalDebt: number;
  orderCount: number;
  roomBookings: number;
  conferenceBookings: number;
  paymentBreakdown: { cash: number; kcb: number; mpesa: number; debt: number };
}

interface DebtOrder {
  id: string;
  order_number: number;
  debtor_name: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
}

interface PeriodData {
  revenue: number;
  expenses: number;
  orderCount: number;
  roomBookings: number;
  conferenceBookings: number;
  paymentBreakdown: { cash: number; kcb: number; mpesa: number; debt: number };
}

interface Order {
  id: string;
  order_number: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  created_at: string;
  payment_method?: string | null;
}

interface RoomBooking {
  id: string;
  guest_name: string;
  price: number;
  amount_paid: number;
  check_in_date: string;
  checkout_date: string;
  rooms: { room_number: string } | null;
}

interface ConferenceBooking {
  id: string;
  guest_name: string;
  company_name: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  conference_rooms: { name: string } | null;
}

interface Expense {
  id: string;
  department: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
}

export interface FullReportData {
  summary: DailySummary;
  periodData: PeriodData;
  debtOrders: DebtOrder[];
  inventory: InventoryItem[];
  orders: Order[];
  roomBookings: RoomBooking[];
  conferenceBookings: ConferenceBooking[];
  expenses: Expense[];
}

// ============ FULL REPORT ============
export const generateFullReport = (
  data: FullReportData,
  options: { title: string; periodLabel: string }
) => {
  const doc = new jsPDF();
  let yPosition = 55;
  
  addHeader(doc, options.title);
  
  // Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FINANCIAL SUMMARY', 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Total Revenue', formatKES(data.summary.totalRevenue)],
      ['Total Expenses', formatKES(data.summary.totalExpenses)],
      ['Net Profit', formatKES(data.summary.totalRevenue - data.summary.totalExpenses)],
      ['Total Debt Outstanding', formatKES(data.summary.totalDebt)],
      ['Total Orders', data.summary.orderCount.toString()],
      ['Room Bookings', data.summary.roomBookings.toString()],
      ['Conference Bookings', data.summary.conferenceBookings.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });
  
  yPosition = (doc as any).lastAutoTable.finalY + 15;
  
  // Payment Breakdown
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT BREAKDOWN', 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Payment Method', 'Amount']],
    body: [
      ['Cash', formatKES(data.summary.paymentBreakdown.cash)],
      ['M-Pesa', formatKES(data.summary.paymentBreakdown.mpesa)],
      ['KCB', formatKES(data.summary.paymentBreakdown.kcb)],
      ['Outstanding Debt', formatKES(data.summary.paymentBreakdown.debt)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    margin: { left: 20, right: 20 },
  });
  
  // Period Data
  doc.addPage();
  yPosition = 30;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`PERIOD REVIEW: ${options.periodLabel}`, 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Period Revenue', formatKES(data.periodData.revenue)],
      ['Period Expenses', formatKES(data.periodData.expenses)],
      ['Period Net Profit', formatKES(data.periodData.revenue - data.periodData.expenses)],
      ['Orders in Period', data.periodData.orderCount.toString()],
      ['Room Bookings', data.periodData.roomBookings.toString()],
      ['Conference Bookings', data.periodData.conferenceBookings.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: [139, 92, 246] },
    margin: { left: 20, right: 20 },
  });
  
  // Sales
  yPosition = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SALES RECORDS', 20, yPosition);
  yPosition += 8;
  
  if (data.orders.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Order ID', 'Date/Time', 'Total', 'Paid', 'Status', 'Payment Method']],
      body: data.orders.map(order => [
        `EH${order.order_number}`,
        format(new Date(order.created_at), 'MMM d, HH:mm'),
        formatKES(order.total_amount),
        formatKES(order.amount_paid),
        order.status,
        order.payment_method || '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
    });
  } else {
    doc.setFontSize(10);
    doc.text('No sales records for this period', 20, yPosition);
  }
  
  // Room Bookings
  doc.addPage();
  yPosition = 30;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ROOM BOOKINGS', 20, yPosition);
  yPosition += 8;
  
  if (data.roomBookings.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Guest Name', 'Room', 'Check-in', 'Checkout', 'Price', 'Paid']],
      body: data.roomBookings.map(booking => [
        booking.guest_name,
        booking.rooms?.room_number || '-',
        booking.check_in_date,
        booking.checkout_date,
        formatKES(booking.price),
        formatKES(booking.amount_paid),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [236, 72, 153] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.text('No room bookings for this period', 20, yPosition);
    yPosition += 15;
  }
  
  // Conference Bookings
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFERENCE BOOKINGS', 20, yPosition);
  yPosition += 8;
  
  if (data.conferenceBookings.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Guest/Company', 'Room', 'Date', 'Time']],
      body: data.conferenceBookings.map(booking => [
        booking.company_name ? `${booking.guest_name} (${booking.company_name})` : booking.guest_name,
        booking.conference_rooms?.name || '-',
        booking.booking_date,
        `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
    });
  } else {
    doc.text('No conference bookings for this period', 20, yPosition);
  }
  
  // Expenses
  doc.addPage();
  yPosition = 30;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPENSES', 20, yPosition);
  yPosition += 8;
  
  if (data.expenses.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Description', 'Department', 'Category', 'Amount', 'Date']],
      body: data.expenses.map(expense => [
        expense.description,
        expense.department,
        expense.category,
        formatKES(expense.amount),
        format(new Date(expense.created_at), 'MMM d, yyyy'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.text('No expenses for this period', 20, yPosition);
    yPosition += 15;
  }
  
  // Debts
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('OUTSTANDING DEBTS', 20, yPosition);
  yPosition += 8;
  
  if (data.debtOrders.length > 0) {
    const totalDebt = data.debtOrders.reduce((sum, d) => sum + (d.total_amount - d.amount_paid), 0);
    autoTable(doc, {
      startY: yPosition,
      head: [['Order ID', 'Debtor Name', 'Total Amount', 'Paid', 'Outstanding', 'Date']],
      body: data.debtOrders.map(debt => [
        `EH${debt.order_number}`,
        debt.debtor_name || 'Unknown',
        formatKES(debt.total_amount),
        formatKES(debt.amount_paid),
        formatKES(debt.total_amount - debt.amount_paid),
        format(new Date(debt.created_at), 'MMM d, yyyy'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
      foot: [['', '', '', 'TOTAL:', formatKES(totalDebt), '']],
      footStyles: { fillColor: [249, 115, 22], fontStyle: 'bold' },
    });
  } else {
    doc.text('No outstanding debts', 20, yPosition);
  }
  
  // Inventory
  doc.addPage();
  yPosition = 30;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INVENTORY STATUS', 20, yPosition);
  yPosition += 8;
  
  if (data.inventory.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Item Name', 'Category', 'Quantity', 'Unit', 'Min Qty', 'Status']],
      body: data.inventory.map(item => [
        item.name,
        item.category,
        item.quantity.toString(),
        item.unit,
        item.min_quantity.toString(),
        item.quantity <= item.min_quantity ? 'LOW STOCK' : 'OK',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.cell.text[0] === 'LOW STOCK') {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  } else {
    doc.text('No inventory items', 20, yPosition);
  }
  
  addFooter(doc);
  doc.save(`Enaitoti_Full_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

// ============ DAILY/PERIOD BREAKDOWN ============
export const generatePeriodReport = (
  data: {
    summary: DailySummary;
    periodData: PeriodData;
    orders: Order[];
    roomBookings: RoomBooking[];
    conferenceBookings: ConferenceBooking[];
    expenses: Expense[];
  },
  periodLabel: string,
  periodType: string
) => {
  const doc = new jsPDF();
  let yPosition = 55;
  
  addHeader(doc, `${periodType.charAt(0).toUpperCase() + periodType.slice(1)} Report - ${periodLabel}`);
  
  // Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Total Revenue', formatKES(data.periodData.revenue)],
      ['Total Expenses', formatKES(data.periodData.expenses)],
      ['Net Profit', formatKES(data.periodData.revenue - data.periodData.expenses)],
      ['Orders', data.periodData.orderCount.toString()],
      ['Room Bookings', data.periodData.roomBookings.toString()],
      ['Conference Bookings', data.periodData.conferenceBookings.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });
  
  yPosition = (doc as any).lastAutoTable.finalY + 15;
  
  // Payment Breakdown
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT METHODS', 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Method', 'Amount']],
    body: [
      ['Cash', formatKES(data.summary.paymentBreakdown.cash)],
      ['M-Pesa', formatKES(data.summary.paymentBreakdown.mpesa)],
      ['KCB', formatKES(data.summary.paymentBreakdown.kcb)],
      ['Outstanding Debt', formatKES(data.summary.paymentBreakdown.debt)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    margin: { left: 20, right: 20 },
  });
  
  // Orders
  if (data.orders.length > 0) {
    doc.addPage();
    yPosition = 30;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDERS', 20, yPosition);
    yPosition += 8;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Order ID', 'Date/Time', 'Total', 'Paid', 'Status']],
      body: data.orders.map(order => [
        `EH${order.order_number}`,
        format(new Date(order.created_at), 'MMM d, HH:mm'),
        formatKES(order.total_amount),
        formatKES(order.amount_paid),
        order.status,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
    });
  }
  
  // Room Bookings
  if (data.roomBookings.length > 0) {
    doc.addPage();
    yPosition = 30;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ROOM BOOKINGS', 20, yPosition);
    yPosition += 8;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Guest', 'Room', 'Check-in', 'Checkout', 'Price', 'Paid']],
      body: data.roomBookings.map(b => [
        b.guest_name,
        b.rooms?.room_number || '-',
        b.check_in_date,
        b.checkout_date,
        formatKES(b.price),
        formatKES(b.amount_paid),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [236, 72, 153] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
    });
  }
  
  // Expenses
  if (data.expenses.length > 0) {
    doc.addPage();
    yPosition = 30;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EXPENSES', 20, yPosition);
    yPosition += 8;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Description', 'Department', 'Category', 'Amount']],
      body: data.expenses.map(e => [
        e.description,
        e.department,
        e.category,
        formatKES(e.amount),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
    });
  }
  
  addFooter(doc);
  doc.save(`Enaitoti_${periodType}_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// ============ DEBTS REPORT ============
export const generateDebtsReport = (debtOrders: DebtOrder[]) => {
  const doc = new jsPDF();
  let yPosition = 55;
  
  addHeader(doc, 'Outstanding Debts Report');
  
  const totalDebt = debtOrders.reduce((sum, d) => sum + (d.total_amount - d.amount_paid), 0);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Outstanding: ${formatKES(totalDebt)}`, 20, yPosition);
  doc.text(`Total Debtors: ${debtOrders.length}`, 120, yPosition);
  yPosition += 12;
  
  if (debtOrders.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Order ID', 'Debtor Name', 'Total Amount', 'Amount Paid', 'Outstanding', 'Date']],
      body: debtOrders.map(debt => [
        `EH${debt.order_number}`,
        debt.debtor_name || 'Unknown',
        formatKES(debt.total_amount),
        formatKES(debt.amount_paid),
        formatKES(debt.total_amount - debt.amount_paid),
        format(new Date(debt.created_at), 'MMM d, yyyy'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 20, right: 20 },
      foot: [['', '', '', 'TOTAL:', formatKES(totalDebt), '']],
      footStyles: { fillColor: [249, 115, 22], fontStyle: 'bold' },
    });
  } else {
    doc.text('No outstanding debts', 20, yPosition);
  }
  
  addFooter(doc);
  doc.save(`Enaitoti_Debts_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// ============ INVENTORY REPORT ============
export const generateInventoryReport = (inventory: InventoryItem[]) => {
  const doc = new jsPDF();
  let yPosition = 55;
  
  addHeader(doc, 'Inventory Status Report');
  
  const lowStock = inventory.filter(i => i.quantity <= i.min_quantity);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Items: ${inventory.length}`, 20, yPosition);
  doc.text(`Low Stock Items: ${lowStock.length}`, 120, yPosition);
  yPosition += 12;
  
  if (lowStock.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('LOW STOCK ALERTS', 20, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 8;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Item Name', 'Category', 'Current Qty', 'Min Qty', 'Unit']],
      body: lowStock.map(item => [
        item.name,
        item.category,
        item.quantity.toString(),
        item.min_quantity.toString(),
        item.unit,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: 20, right: 20 },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ALL INVENTORY', 20, yPosition);
  yPosition += 8;
  
  if (inventory.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Item Name', 'Category', 'Quantity', 'Unit', 'Min Qty', 'Status']],
      body: inventory.map(item => [
        item.name,
        item.category,
        item.quantity.toString(),
        item.unit,
        item.min_quantity.toString(),
        item.quantity <= item.min_quantity ? 'LOW' : 'OK',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.cell.text[0] === 'LOW') {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }
  
  addFooter(doc);
  doc.save(`Enaitoti_Inventory_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// ============ OCCUPANCY REPORT ============
export const generateOccupancyReport = (
  roomStats: { total: number; occupied: number; available: number; maintenance: number },
  conferenceStats: { todayBookings: number; weekBookings: number }
) => {
  const doc = new jsPDF();
  let yPosition = 55;
  
  addHeader(doc, 'Occupancy Report');
  
  const occupancyRate = roomStats.total > 0 ? ((roomStats.occupied / roomStats.total) * 100).toFixed(1) : '0';
  
  // Room Occupancy
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ROOM OCCUPANCY', 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Total Rooms', roomStats.total.toString()],
      ['Occupied', roomStats.occupied.toString()],
      ['Available', roomStats.available.toString()],
      ['Maintenance', roomStats.maintenance.toString()],
      ['Occupancy Rate', `${occupancyRate}%`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [236, 72, 153] },
    margin: { left: 20, right: 20 },
  });
  
  yPosition = (doc as any).lastAutoTable.finalY + 20;
  
  // Conference Usage
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFERENCE USAGE', 20, yPosition);
  yPosition += 8;
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Bookings Today', conferenceStats.todayBookings.toString()],
      ['Bookings This Week', conferenceStats.weekBookings.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11] },
    margin: { left: 20, right: 20 },
  });
  
  addFooter(doc);
  doc.save(`Enaitoti_Occupancy_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

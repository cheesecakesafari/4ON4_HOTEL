import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  item_name: string | null;
  item_type: string | null;
  menu_items: { name: string } | null;
}

interface Order {
  id: string;
  order_number: number;
  total_amount: number;
  amount_paid: number;
  payment_method: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

const VAT_RATE = 0.16;

const calculateVatFromInclusive = (total: number) => {
  return total * (VAT_RATE / (1 + VAT_RATE));
};

const calculatePreVatAmount = (total: number) => {
  return total / (1 + VAT_RATE);
};

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

export const generateReceiptPdf = (orders: Order[]) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // Thermal receipt paper size
  });

  const pageWidth = 80;
  let y = 10;

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ENAITOTI HOTEL', pageWidth / 2, y, { align: 'center' });
  y += 6;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Official Receipt', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Divider
  doc.setDrawColor(200);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Order number(s)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  if (orders.length === 1) {
    doc.text(`Order: EH${orders[0].order_number}`, pageWidth / 2, y, { align: 'center' });
  } else {
    const orderNums = orders.map(o => `EH${o.order_number}`).join(' + ');
    doc.text(`Orders: ${orderNums}`, pageWidth / 2, y, { align: 'center' });
  }
  y += 6;

  // Divider
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Items
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const allItems = orders.flatMap(o => o.order_items || []);
  
  allItems.forEach(item => {
    const itemName = item.item_name || item.menu_items?.name || 'Unknown';
    const qty = `${item.quantity}x`;
    const price = formatKES(item.price * item.quantity);
    
    const leftText = `${qty} ${itemName}`;
    doc.text(leftText, 5, y);
    doc.text(price, pageWidth - 5, y, { align: 'right' });
    y += 4;

    // Check if we need a new page
    if (y > 180) {
      doc.addPage([80, 200]);
      y = 10;
    }
  });

  y += 2;

  // Divider
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Totals
  const total = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const preVat = calculatePreVatAmount(total);
  const vat = calculateVatFromInclusive(total);

  doc.setFontSize(8);
  doc.text('Subtotal (excl. VAT):', 5, y);
  doc.text(formatKES(preVat), pageWidth - 5, y, { align: 'right' });
  y += 4;

  doc.text('VAT (16%):', 5, y);
  doc.text(formatKES(vat), pageWidth - 5, y, { align: 'right' });
  y += 4;

  // Divider
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Grand Total
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 5, y);
  doc.text(formatKES(total), pageWidth - 5, y, { align: 'right' });
  y += 6;

  // Payment Method - Parse all payment methods with amounts
  const paymentDetails: { method: string; amount: number }[] = [];
  
  orders.forEach(o => {
    if (o.payment_method) {
      // Check if it's the new format "method:amount,method:amount"
      if (o.payment_method.includes(':')) {
        const parts = o.payment_method.split(',');
        parts.forEach((part: string) => {
          const [method, amtStr] = part.split(':');
          const amt = parseFloat(amtStr) || 0;
          if (amt > 0) {
            const existing = paymentDetails.find(p => p.method === method);
            if (existing) {
              existing.amount += amt;
            } else {
              paymentDetails.push({ method, amount: amt });
            }
          }
        });
      } else {
        // Old format - just the method name
        const methodName = o.payment_method.toLowerCase();
        const existing = paymentDetails.find(p => p.method === methodName);
        if (existing) {
          existing.amount += o.amount_paid;
        } else {
          paymentDetails.push({ method: methodName, amount: o.amount_paid });
        }
      }
    }
  });
  
  if (paymentDetails.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment:', 5, y);
    y += 4;
    
    paymentDetails.forEach(pd => {
      const methodLabel = pd.method === 'mpesa' ? 'M-Pesa' : 
                         pd.method === 'kcb' ? 'KCB' : 
                         pd.method === 'cash' ? 'Cash' :
                         pd.method === 'mobile' ? 'M-Pesa' :
                         pd.method === 'card' ? 'KCB' :
                         pd.method.charAt(0).toUpperCase() + pd.method.slice(1);
      doc.text(`  ${methodLabel}:`, 5, y);
      doc.text(formatKES(pd.amount), pageWidth - 5, y, { align: 'right' });
      y += 4;
    });
  }

  // VAT Notice
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('*Prices inclusive of 16% VAT', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Divider
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Footer
  doc.setFontSize(8);
  doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text('Powered by 4on4 tech', pageWidth / 2, y, { align: 'center' });

  // Generate filename
  const orderNumbers = orders.map(o => `EH${o.order_number}`).join('_');
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  
  return {
    doc,
    filename: `Receipt_${orderNumbers}_${timestamp}.pdf`
  };
};

export const downloadReceiptPdf = (orders: Order[]) => {
  const { doc, filename } = generateReceiptPdf(orders);
  doc.save(filename);
};

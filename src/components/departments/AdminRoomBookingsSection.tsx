import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bed, CreditCard, Download, Calendar, User, Phone, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import jsPDF from 'jspdf';

interface RoomBooking {
  id: string;
  trip_number: number;
  guest_name: string;
  guest_phone: string | null;
  debtor_name: string | null;
  check_in_date: string;
  checkout_date: string;
  price: number;
  amount_paid: number;
  payment_method: string | null;
  created_at: string;
  staff_id: string | null;
  rooms: { room_number: string; room_type: string } | null;
  employees: { name: string } | null;
}

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
}

interface Props {
  adminId: string;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const formatTripNumber = (num: number) => `EN-R/${String(num).padStart(3, '0')}`;

export default function AdminRoomBookingsSection({ adminId }: Props) {
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<RoomBooking | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearAmount, setClearAmount] = useState('');
  const [clearMethod, setClearMethod] = useState<string>('cash');
  const { toast } = useToast();

  useEffect(() => {
    fetchBookings();
    fetchRooms();
  }, []);

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('room_bookings')
      .select('*, rooms(room_number, room_type), employees:staff_id(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setBookings(data as RoomBooking[]);
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('room_number');
    if (data) setRooms(data);
  };

  const pendingBookings = bookings.filter(b => b.amount_paid < b.price);
  const paidBookings = bookings.filter(b => b.amount_paid >= b.price);

  // Calculate totals
  const totalRevenue = bookings.reduce((sum, b) => sum + b.amount_paid, 0);
  const totalPending = bookings.reduce((sum, b) => sum + Math.max(0, b.price - b.amount_paid), 0);

  // Payment breakdown
  let cashPaid = 0, mpesaPaid = 0, kcbPaid = 0;
  bookings.forEach(b => {
    if (b.payment_method) {
      const parts = b.payment_method.split(',');
      parts.forEach(part => {
        if (part.includes(':')) {
          const [method, amt] = part.split(':');
          const amount = parseFloat(amt) || 0;
          if (method === 'cash') cashPaid += amount;
          else if (method === 'mpesa') mpesaPaid += amount;
          else if (method === 'kcb') kcbPaid += amount;
        }
      });
    }
  });

  const handleClearPayment = async () => {
    if (!selectedBooking) return;
    const amount = parseFloat(clearAmount) || 0;
    if (amount <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }

    const newAmountPaid = selectedBooking.amount_paid + amount;
    const remaining = selectedBooking.price - newAmountPaid;

    // Build payment method string
    let newPaymentMethod = selectedBooking.payment_method || '';
    if (newPaymentMethod && !newPaymentMethod.includes(':')) {
      newPaymentMethod = '';
    }
    const paymentPart = `${clearMethod}:${amount}`;
    newPaymentMethod = newPaymentMethod ? `${newPaymentMethod},${paymentPart}` : paymentPart;

    try {
      const { error } = await supabase
        .from('room_bookings')
        .update({
          amount_paid: newAmountPaid,
          payment_method: newPaymentMethod,
          debtor_name: remaining > 0 ? selectedBooking.debtor_name : null,
        })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      // Update room status if fully paid and checkout date passed
      if (remaining <= 0 && selectedBooking.rooms) {
        const today = new Date();
        const checkoutDate = new Date(selectedBooking.checkout_date);
        if (today >= checkoutDate) {
          await supabase
            .from('rooms')
            .update({ status: 'available' })
            .eq('room_number', selectedBooking.rooms.room_number);
        }
      }

      toast({ 
        title: remaining <= 0 ? 'Payment cleared!' : 'Partial payment recorded',
        description: remaining > 0 ? `Remaining: ${formatKES(remaining)}` : undefined
      });
      
      setClearDialogOpen(false);
      setClearAmount('');
      setSelectedBooking(null);
      fetchBookings();
      fetchRooms();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const formatDateRange = (checkIn: string, checkOut: string) => {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const startDay = format(startDate, 'd');
    const endFormatted = format(endDate, 'd MMM yyyy');
    
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDay}-${endFormatted}`;
    }
    return `${format(startDate, 'd MMM')} - ${endFormatted}`;
  };

  const generateRoomReceipt = (booking: RoomBooking) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 160],
    });

    const pageWidth = 80;
    let y = 10;
    const days = differenceInDays(new Date(booking.checkout_date), new Date(booking.check_in_date)) || 1;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ENAITOTI HOTEL', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Room Booking Receipt', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(formatTripNumber(booking.trip_number), pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(booking.created_at), 'dd/MM/yyyy HH:mm'), pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.line(5, y, pageWidth - 5, y);
    y += 4;

    doc.setFontSize(8);
    doc.text(`Guest: ${booking.guest_name}`, 5, y);
    y += 4;
    if (booking.guest_phone) {
      doc.text(`Phone: ${booking.guest_phone}`, 5, y);
      y += 4;
    }
    doc.text(`Room: ${booking.rooms?.room_number || 'N/A'} (${booking.rooms?.room_type || ''})`, 5, y);
    y += 4;
    doc.text(`Period: ${formatDateRange(booking.check_in_date, booking.checkout_date)}`, 5, y);
    y += 4;
    doc.text(`Duration: ${days} night${days > 1 ? 's' : ''}`, 5, y);
    y += 4;
    doc.text(`Staff: ${booking.employees?.name || 'N/A'}`, 5, y);
    y += 6;

    doc.line(5, y, pageWidth - 5, y);
    y += 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', 5, y);
    doc.text(formatKES(booking.price), pageWidth - 5, y, { align: 'right' });
    y += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Paid:', 5, y);
    doc.text(formatKES(booking.amount_paid), pageWidth - 5, y, { align: 'right' });
    y += 4;

    const balance = booking.price - booking.amount_paid;
    if (balance > 0) {
      doc.setTextColor(200, 0, 0);
      doc.text('Balance:', 5, y);
      doc.text(formatKES(balance), pageWidth - 5, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 4;
    }
    y += 2;

    // Payment details
    if (booking.payment_method) {
      doc.setFontSize(7);
      doc.text('Payment Breakdown:', 5, y);
      y += 3;
      const parts = booking.payment_method.split(',');
      parts.forEach(part => {
        if (part.includes(':')) {
          const [method, amt] = part.split(':');
          doc.text(`  ${method.toUpperCase()}: ${formatKES(parseFloat(amt))}`, 5, y);
          y += 3;
        }
      });
    }

    y += 4;
    doc.line(5, y, pageWidth - 5, y);
    y += 4;

    doc.setFontSize(7);
    doc.text('Thank you for staying with us!', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.setTextColor(150);
    doc.text('Powered by 4on4 tech', pageWidth / 2, y, { align: 'center' });

    doc.save(`Receipt_${formatTripNumber(booking.trip_number)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const generateRoomInvoice = (booking: RoomBooking) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 160],
    });

    const pageWidth = 80;
    let y = 10;
    const days = differenceInDays(new Date(booking.checkout_date), new Date(booking.check_in_date)) || 1;
    const balance = booking.price - booking.amount_paid;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ENAITOTI HOTEL', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE - PENDING PAYMENT', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(formatTripNumber(booking.trip_number), pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), 'dd/MM/yyyy'), pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.line(5, y, pageWidth - 5, y);
    y += 4;

    doc.setFontSize(8);
    doc.text(`Bill To: ${booking.debtor_name || booking.guest_name}`, 5, y);
    y += 4;
    doc.text(`Guest: ${booking.guest_name}`, 5, y);
    y += 4;
    if (booking.guest_phone) {
      doc.text(`Phone: ${booking.guest_phone}`, 5, y);
      y += 4;
    }
    doc.text(`Room: ${booking.rooms?.room_number || 'N/A'}`, 5, y);
    y += 4;
    doc.text(`Period: ${formatDateRange(booking.check_in_date, booking.checkout_date)}`, 5, y);
    y += 4;
    doc.text(`Duration: ${days} night${days > 1 ? 's' : ''}`, 5, y);
    y += 6;

    doc.line(5, y, pageWidth - 5, y);
    y += 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Amount:', 5, y);
    doc.text(formatKES(booking.price), pageWidth - 5, y, { align: 'right' });
    y += 5;

    doc.setFontSize(9);
    doc.text('Amount Paid:', 5, y);
    doc.text(formatKES(booking.amount_paid), pageWidth - 5, y, { align: 'right' });
    y += 5;

    doc.setTextColor(200, 0, 0);
    doc.setFontSize(11);
    doc.text('BALANCE DUE:', 5, y);
    doc.text(formatKES(balance), pageWidth - 5, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.line(5, y, pageWidth - 5, y);
    y += 4;

    doc.setFontSize(7);
    doc.text('Please settle this amount at your earliest convenience.', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setTextColor(150);
    doc.text('Powered by 4on4 tech', pageWidth / 2, y, { align: 'center' });

    doc.save(`Invoice_${formatTripNumber(booking.trip_number)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">{formatKES(totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">Total Revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{formatKES(totalPending)}</div>
            <div className="text-xs text-muted-foreground">Pending (Debtors)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{bookings.length}</div>
            <div className="text-xs text-muted-foreground">Total Bookings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-xs space-y-1">
              <div>Cash: <span className="font-medium">{formatKES(cashPaid)}</span></div>
              <div>M-Pesa: <span className="font-medium">{formatKES(mpesaPaid)}</span></div>
              <div>KCB: <span className="font-medium">{formatKES(kcbPaid)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bed className="w-4 h-4" />
            Room Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm">Available: {rooms.filter(r => r.status === 'available').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm">Occupied: {rooms.filter(r => r.status === 'occupied').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-sm">Pending Payments: {pendingBookings.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Debtors ({pendingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Paid ({paidBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {pendingBookings.map(booking => {
              const days = differenceInDays(new Date(booking.checkout_date), new Date(booking.check_in_date)) || 1;
              const balance = booking.price - booking.amount_paid;
              return (
                <Card key={booking.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{formatTripNumber(booking.trip_number)}</Badge>
                          <User className="w-4 h-4" />
                          {booking.guest_name}
                          {booking.debtor_name && booking.debtor_name !== booking.guest_name && (
                            <Badge variant="secondary" className="text-xs">Bill to: {booking.debtor_name}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <Bed className="w-3 h-3" />
                          Room {booking.rooms?.room_number} ({booking.rooms?.room_type})
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {formatDateRange(booking.check_in_date, booking.checkout_date)} ({days} night{days > 1 ? 's' : ''})
                        </div>
                        {booking.guest_phone && (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            {booking.guest_phone}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Staff: {booking.employees?.name || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">Total: {formatKES(booking.price)}</div>
                        <div className="text-sm text-green-600">Paid: {formatKES(booking.amount_paid)}</div>
                        <div className="font-bold text-orange-600">Balance: {formatKES(balance)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setClearAmount(balance.toString());
                          setClearDialogOpen(true);
                        }}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        Clear Payment
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => generateRoomInvoice(booking)}>
                        <FileText className="w-3 h-3 mr-1" />
                        Invoice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => generateRoomReceipt(booking)}>
                        <Download className="w-3 h-3 mr-1" />
                        Receipt
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {pendingBookings.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No pending payments</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="paid" className="mt-4">
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {paidBookings.map(booking => {
              const days = differenceInDays(new Date(booking.checkout_date), new Date(booking.check_in_date)) || 1;
              return (
                <Card key={booking.id}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{formatTripNumber(booking.trip_number)}</Badge>
                        {booking.guest_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Room {booking.rooms?.room_number} • {formatDateRange(booking.check_in_date, booking.checkout_date)} ({days} nights)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Staff: {booking.employees?.name || 'Unknown'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-green-600">{formatKES(booking.price)}</span>
                      <Button size="sm" variant="ghost" onClick={() => generateRoomReceipt(booking)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {paidBookings.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No completed bookings</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Clear Payment Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Room Payment</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">{selectedBooking.guest_name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatTripNumber(selectedBooking.trip_number)} • Room {selectedBooking.rooms?.room_number} • Balance: {formatKES(selectedBooking.price - selectedBooking.amount_paid)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount to Clear</Label>
                <Input
                  type="number"
                  value={clearAmount}
                  onChange={(e) => setClearAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={clearMethod} onValueChange={setClearMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="kcb">KCB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleClearPayment} className="w-full">Clear Payment</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bed, Plus, Calendar, CreditCard, Shirt, Receipt, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import ExpensesSection from './ExpensesSection';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
}

interface Booking {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  check_in_date: string;
  checkout_date: string;
  price: number;
  amount_paid: number;
  payment_method: string | null;
  rooms: { room_number: string } | null;
}

interface LaundryItem {
  id: string;
  item_type: string;
  quantity: number;
  status: string;
  rooms: { room_number: string } | null;
  created_at: string;
}

interface Props {
  employeeId: string;
  employeeName: string;
}

export default function RoomsTab({ employeeId, employeeName }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [laundryItems, setLaundryItems] = useState<LaundryItem[]>([]);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isLaundryDialogOpen, setIsLaundryDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Booking form
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [price, setPrice] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('pending');
  const [debtorName, setDebtorName] = useState('');

  // Laundry form
  const [laundryType, setLaundryType] = useState<string>('bedsheet');
  const [laundryQuantity, setLaundryQuantity] = useState('1');
  const [laundryRoom, setLaundryRoom] = useState<string>('');

  const { toast } = useToast();

  useEffect(() => {
    if (!employeeId) return;
    fetchRooms();
    fetchBookings();
    fetchLaundryItems();
  }, [employeeId]);

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('room_number');
    if (data) setRooms(data);
  };

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('room_bookings')
      .select('*, rooms(room_number)')
      .eq('staff_id', employeeId)
      .order('check_in_date', { ascending: false })
      .limit(50);
    if (data) setBookings(data as Booking[]);
  };

  const fetchLaundryItems = async () => {
    const { data } = await supabase
      .from('laundry_items')
      .select('*, rooms(room_number)')
      .eq('staff_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setLaundryItems(data as LaundryItem[]);
  };

  const handleCreateBooking = async () => {
    if (!selectedRoom || !guestName || !checkIn || !checkOut || !price) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    try {
      const paid = parseFloat(amountPaid) || 0;
      const isPending = paymentMethod === 'pending' || paid === 0;
      
      const { error: bookingError } = await supabase.from('room_bookings').insert({
        room_id: selectedRoom.id,
        guest_name: guestName,
        guest_phone: guestPhone || null,
        check_in_date: checkIn,
        checkout_date: checkOut,
        price: parseFloat(price),
        amount_paid: paid,
        payment_method: isPending ? null : `${paymentMethod}:${paid}`,
        debtor_name: isPending ? (debtorName || guestName) : null,
        staff_id: employeeId,
      });

      if (bookingError) throw bookingError;

      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', selectedRoom.id);

      if (roomError) throw roomError;

      toast({ title: 'Booking created!' });
      resetBookingForm();
      setIsBookingDialogOpen(false);
      fetchRooms();
      fetchBookings();
    } catch (error: any) {
      toast({ title: 'Error creating booking', description: error.message, variant: 'destructive' });
    }
  };

  const resetBookingForm = () => {
    setSelectedRoom(null);
    setGuestName('');
    setGuestPhone('');
    setCheckIn('');
    setCheckOut('');
    setPrice('');
    setAmountPaid('');
    setPaymentMethod('pending');
    setDebtorName('');
  };

  const handleAddLaundry = async () => {
    try {
      const { error } = await supabase.from('laundry_items').insert({
        item_type: laundryType,
        quantity: parseInt(laundryQuantity) || 1,
        room_id: laundryRoom || null,
        staff_id: employeeId,
        status: 'pending',
      });

      if (error) throw error;

      toast({ title: 'Laundry item added!' });
      setIsLaundryDialogOpen(false);
      setLaundryType('bedsheet');
      setLaundryQuantity('1');
      setLaundryRoom('');
      fetchLaundryItems();
    } catch (error: any) {
      toast({ title: 'Error adding laundry', description: error.message, variant: 'destructive' });
    }
  };

  const updateLaundryStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('laundry_items')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      fetchLaundryItems();
    } catch (error: any) {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    }
  };

  const updateRoomStatus = async (roomId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('rooms').update({ status: newStatus }).eq('id', roomId);
      if (error) throw error;
      fetchRooms();
    } catch (error: any) {
      toast({ title: 'Error updating room', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/10 text-green-600';
      case 'occupied': return 'bg-red-500/10 text-red-600';
      case 'maintenance': return 'bg-orange-500/10 text-orange-600';
      case 'reserved': return 'bg-blue-500/10 text-blue-600';
      case 'pending': return 'bg-yellow-500/10 text-yellow-600';
      case 'cleaning': return 'bg-blue-500/10 text-blue-600';
      case 'ready': return 'bg-green-500/10 text-green-600';
      case 'delivered': return 'bg-emerald-500/10 text-emerald-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getLaundryIcon = (type: string) => {
    switch (type) {
      case 'bedsheet': return '🛏️';
      case 'towel': return '🧴';
      case 'uniform': return '👔';
      case 'tablecloth': return '🍽️';
      default: return '📦';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Bed className="w-6 h-6" />
            Rooms & Laundry
          </h2>
          <p className="text-muted-foreground">Staff: {employeeName}</p>
        </div>
      </div>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList>
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <Bed className="w-4 h-4" />
            Rooms
          </TabsTrigger>
          <TabsTrigger value="laundry" className="flex items-center gap-2">
            <Shirt className="w-4 h-4" />
            Laundry
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6 mt-6">
          {/* Room Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">All Rooms</h3>
              <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Booking
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Booking</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Select Room</Label>
                      <Select
                        value={selectedRoom?.id || ''}
                        onValueChange={(val) => setSelectedRoom(rooms.find(r => r.id === val) || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a room" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.filter(r => r.status === 'available').map(room => (
                            <SelectItem key={room.id} value={room.id}>
                              Room {room.room_number} ({room.room_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Guest Name *</Label>
                      <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Guest Phone</Label>
                      <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Check-in Date *</Label>
                        <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Checkout Date *</Label>
                        <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Price *</Label>
                        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount Paid</Label>
                        <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending (Debtor)</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mpesa">M-Pesa</SelectItem>
                          <SelectItem value="kcb">KCB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {paymentMethod === 'pending' && (
                      <div className="space-y-2">
                        <Label>Debtor Name (who pays)</Label>
                        <Input value={debtorName} onChange={(e) => setDebtorName(e.target.value)} placeholder="Leave empty to use guest name" />
                      </div>
                    )}
                    <Button onClick={handleCreateBooking} className="w-full">
                      Create Booking
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {rooms.map(room => (
                <Card
                  key={room.id}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    room.status === 'available' ? 'border-green-500/50' : ''
                  }`}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{room.room_number}</div>
                    <div className="text-xs text-muted-foreground mb-2">{room.room_type}</div>
                    <Select
                      value={room.status}
                      onValueChange={(val) => updateRoomStatus(room.id, val)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <Badge className={`${getStatusColor(room.status)} text-xs`}>{room.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
              {rooms.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  No rooms configured yet.
                </p>
              )}
            </div>
          </div>

          {/* Recent Bookings */}
          <div>
            <h3 className="text-lg font-medium mb-4">Recent Bookings</h3>
            <div className="space-y-3">
              {bookings.slice(0, 10).map(booking => (
                <Card key={booking.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{booking.guest_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {booking.check_in_date} → {booking.checkout_date}
                        <span className="ml-2">Room: {booking.rooms?.room_number}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        KES {booking.amount_paid.toLocaleString('en-KE')} / KES {booking.price.toLocaleString('en-KE')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {bookings.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No bookings yet.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="laundry" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Internal Linens</h3>
            <Dialog open={isLaundryDialogOpen} onOpenChange={setIsLaundryDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Laundry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Add Laundry Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Item Type</Label>
                    <Select value={laundryType} onValueChange={setLaundryType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bedsheet">🛏️ Bedsheet</SelectItem>
                        <SelectItem value="towel">🧴 Towel</SelectItem>
                        <SelectItem value="uniform">👔 Uniform</SelectItem>
                        <SelectItem value="tablecloth">🍽️ Tablecloth</SelectItem>
                        <SelectItem value="other">📦 Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={laundryQuantity}
                      onChange={(e) => setLaundryQuantity(e.target.value)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From Room (optional)</Label>
                    <Select value={laundryRoom} onValueChange={setLaundryRoom}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No room</SelectItem>
                        {rooms.map(room => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddLaundry} className="w-full">
                    Add Laundry Item
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {laundryItems.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{getLaundryIcon(item.item_type)}</span>
                    <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                  </div>
                  <div className="font-medium capitalize">{item.item_type}</div>
                  <div className="text-sm text-muted-foreground">
                    Qty: {item.quantity}
                    {item.rooms?.room_number && ` • Room ${item.rooms.room_number}`}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {item.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => updateLaundryStatus(item.id, 'cleaning')}>
                        Start Cleaning
                      </Button>
                    )}
                    {item.status === 'cleaning' && (
                      <Button size="sm" variant="outline" onClick={() => updateLaundryStatus(item.id, 'ready')}>
                        Mark Ready
                      </Button>
                    )}
                    {item.status === 'ready' && (
                      <Button size="sm" variant="outline" onClick={() => updateLaundryStatus(item.id, 'delivered')}>
                        Delivered
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {laundryItems.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                No laundry items tracked yet.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <ExpensesSection department="rooms" employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Booking History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {bookings.map(booking => (
                  <div key={booking.id} className="p-3 bg-muted/50 rounded-lg flex justify-between">
                    <div>
                      <div className="font-medium">{booking.guest_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Room {booking.rooms?.room_number} • {booking.check_in_date} to {booking.checkout_date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">KES {booking.price.toLocaleString('en-KE')}</div>
                      <div className="text-xs text-muted-foreground">Paid: KES {booking.amount_paid.toLocaleString('en-KE')}</div>
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No booking history</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

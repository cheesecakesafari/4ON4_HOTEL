import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarIcon, Plus, Clock, Users, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ConferenceRoom {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

interface Booking {
  id: string;
  guest_name: string;
  company_name: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  conference_rooms: { name: string; capacity: number } | null;
}

interface Props {
  employeeId: string;
  employeeName: string;
}

export default function ConferenceTab({ employeeId, employeeName }: Props) {
  const [rooms, setRooms] = useState<ConferenceRoom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!employeeId) return;
    fetchRooms();
    fetchBookings();
    fetchMyBookings();
  }, [employeeId]);

  const fetchRooms = async () => {
    const { data } = await supabase.from('conference_rooms').select('*').order('name');
    if (data) setRooms(data);
  };

  const fetchBookings = async () => {
    // Today's and future bookings (visible to all)
    const { data } = await supabase
      .from('conference_bookings')
      .select('*, conference_rooms(name, capacity)')
      .gte('booking_date', format(new Date(), 'yyyy-MM-dd'))
      .order('booking_date')
      .order('start_time');
    if (data) setBookings(data as Booking[]);
  };

  const fetchMyBookings = async () => {
    // My booking history only
    const { data } = await supabase
      .from('conference_bookings')
      .select('*, conference_rooms(name, capacity)')
      .eq('staff_id', employeeId)
      .order('booking_date', { ascending: false })
      .order('start_time')
      .limit(100);
    if (data) setAllBookings(data as Booking[]);
  };

  const handleCreateBooking = async () => {
    if (!selectedRoom || !guestName || !bookingDate || !startTime || !endTime) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('conference_bookings').insert({
        room_id: selectedRoom,
        guest_name: guestName,
        company_name: companyName || null,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        staff_id: employeeId,
      });

      if (error) throw error;

      toast({ title: 'Booking created!' });
      setIsDialogOpen(false);
      resetForm();
      fetchBookings();
    } catch (error: any) {
      toast({ title: 'Error creating booking', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setSelectedRoom('');
    setGuestName('');
    setCompanyName('');
    setBookingDate('');
    setStartTime('');
    setEndTime('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/10 text-green-600';
      case 'booked': return 'bg-red-500/10 text-red-600';
      case 'maintenance': return 'bg-orange-500/10 text-orange-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Group bookings by date
  const groupedBookings = bookings.reduce((acc, booking) => {
    const date = booking.booking_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(booking);
    return acc;
  }, {} as Record<string, Booking[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6" />
            Conference
          </h2>
          <p className="text-muted-foreground">Staff: {employeeName}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Book Conference Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Room *</Label>
                <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} (Capacity: {room.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guest/Contact Name *</Label>
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleCreateBooking} className="w-full">
                Create Booking
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList>
          <TabsTrigger value="bookings" className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Rooms
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-6">
          <h3 className="text-lg font-medium mb-4">Conference Rooms</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <Card key={room.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{room.name}</CardTitle>
                    <Badge className={getStatusColor(room.status)}>{room.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    Capacity: {room.capacity} people
                  </div>
                </CardContent>
              </Card>
            ))}
            {rooms.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                No conference rooms configured yet.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          <h3 className="text-lg font-medium mb-4">Upcoming Bookings</h3>
          <div className="space-y-6">
            {Object.entries(groupedBookings).map(([date, dateBookings]) => (
            <div key={date}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </h4>
              <div className="space-y-2">
                {dateBookings.map(booking => (
                  <Card key={booking.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{booking.guest_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {booking.company_name && `${booking.company_name} • `}
                          {booking.conference_rooms?.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No upcoming bookings.
            </p>
          )}
          </div>
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
                {allBookings.map(booking => (
                  <div key={booking.id} className="p-3 bg-muted/50 rounded-lg flex justify-between">
                    <div>
                      <div className="font-medium">{booking.guest_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {booking.company_name && `${booking.company_name} • `}
                        {booking.conference_rooms?.name} • {format(new Date(booking.booking_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="text-sm">
                      {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                    </div>
                  </div>
                ))}
                {allBookings.length === 0 && (
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

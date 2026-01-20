import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployee, DepartmentRole } from '@/contexts/EmployeeContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, User } from 'lucide-react';
import NewRestaurantTab from '@/components/departments/NewRestaurantTab';
import NewKitchenTab from '@/components/departments/NewKitchenTab';
import RoomsTab from '@/components/departments/RoomsTab';
import ConferenceTab from '@/components/departments/ConferenceTab';
import AccountantTab from '@/components/departments/AccountantTab';
import AdminTab from '@/components/departments/AdminTab';
import BarTab from '@/components/departments/BarTab';
import BarAdminTab from '@/components/departments/BarAdminTab';

const DEPARTMENT_CONFIG: Record<DepartmentRole, { label: string; icon: string }> = {
  restaurant: { label: 'Restaurant', icon: '🍽️' },
  kitchen: { label: 'Kitchen', icon: '👨‍🍳' },
  rooms: { label: 'Rooms', icon: '🛏️' },
  conference: { label: 'Conference', icon: '📅' },
  bar: { label: 'Bar', icon: '🍺' },
  bar_admin: { label: 'Bar Admin', icon: '🍻' },
  accountant: { label: 'Accountant', icon: '📊' },
  admin: { label: 'Admin', icon: '⚙️' },
};

export default function Dashboard() {
  const { employee, isLoading, logout, activeDepartment, setActiveDepartment } = useEmployee();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !employee) {
      navigate('/');
    }
  }, [employee, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!employee) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const renderDepartmentContent = (dept: DepartmentRole) => {
    switch (dept) {
      case 'restaurant':
        return <NewRestaurantTab employeeId={employee.id} employeeName={employee.name} />;
      case 'kitchen':
        return <NewKitchenTab employeeId={employee.id} employeeName={employee.name} />;
      case 'rooms':
        return <RoomsTab employeeId={employee.id} employeeName={employee.name} />;
      case 'conference':
        return <ConferenceTab employeeId={employee.id} employeeName={employee.name} />;
      case 'bar':
        return <BarTab employeeId={employee.id} employeeName={employee.name} />;
      case 'bar_admin':
        return <BarAdminTab />;
      case 'accountant':
        return <AccountantTab />;
      case 'admin':
        return <AdminTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏨</span>
            <span className="font-semibold text-lg hidden sm:block">Hotel Management</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{employee.name}</span>
              <span className="font-mono bg-muted px-2 py-1 rounded">#{employee.login_number}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Department Tabs */}
      <main className="container mx-auto px-4 py-6">
        <Tabs
          value={activeDepartment || employee.departments[0]}
          onValueChange={(value) => setActiveDepartment(value as DepartmentRole)}
          className="w-full"
        >
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-6 h-auto p-1">
            {employee.departments.map((dept) => (
              <TabsTrigger
                key={dept}
                value={dept}
                className="flex items-center gap-2 whitespace-nowrap px-4 py-2"
              >
                <span>{DEPARTMENT_CONFIG[dept].icon}</span>
                <span>{DEPARTMENT_CONFIG[dept].label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {employee.departments.map((dept) => (
            <TabsContent key={dept} value={dept} className="mt-0">
              {renderDepartmentContent(dept)}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

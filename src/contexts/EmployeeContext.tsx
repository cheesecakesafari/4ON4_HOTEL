import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DepartmentRole = 'restaurant' | 'kitchen' | 'rooms' | 'conference' | 'accountant' | 'admin' | 'bar' | 'bar_admin';

interface Employee {
  id: string;
  name: string;
  phone: string;
  login_number: string;
  departments: DepartmentRole[];
}

interface EmployeeContextType {
  employee: Employee | null;
  isLoading: boolean;
  login: (loginNumber: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  activeDepartment: DepartmentRole | null;
  setActiveDepartment: (dept: DepartmentRole) => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDepartment, setActiveDepartment] = useState<DepartmentRole | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('hotel_employee');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setEmployee(parsed);
        if (parsed.departments?.length > 0) {
          setActiveDepartment(parsed.departments[0]);
        }
      } catch (e) {
        localStorage.removeItem('hotel_employee');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (loginNumber: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Find employee by login_number (staff code is unique identifier)
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('login_number', loginNumber)
        .maybeSingle();

      if (empError) throw empError;
      if (!empData) return { success: false, error: 'Staff not found' };

      const { data: deptData, error: deptError } = await supabase
        .from('employee_departments')
        .select('department')
        .eq('employee_id', empData.id);

      if (deptError) throw deptError;

      const departments = deptData?.map(d => d.department as DepartmentRole) || [];
      
      if (departments.length === 0) {
        return { success: false, error: 'No departments assigned' };
      }

      const employeeData: Employee = {
        id: empData.id,
        name: empData.name,
        phone: empData.phone,
        login_number: empData.login_number,
        departments,
      };

      setEmployee(employeeData);
      setActiveDepartment(departments[0]);
      localStorage.setItem('hotel_employee', JSON.stringify(employeeData));

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = () => {
    setEmployee(null);
    setActiveDepartment(null);
    localStorage.removeItem('hotel_employee');
  };

  return (
    <EmployeeContext.Provider value={{ employee, isLoading, login, logout, activeDepartment, setActiveDepartment }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const context = useContext(EmployeeContext);
  if (context === undefined) {
    throw new Error('useEmployee must be used within an EmployeeProvider');
  }
  return context;
}

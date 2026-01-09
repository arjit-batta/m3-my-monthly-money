import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, startOfMonth, endOfMonth, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Filter, X, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useBudgetData } from '@/hooks/useBudgetData';
import { getExpenses, getCategories, getPaymentModes } from '@/lib/database';
import { cn } from '@/lib/utils';
import { Category, PaymentMode, Expense } from '@/types/expense';

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(percentage: number, hasBudget: boolean): string {
  if (!hasBudget) return 'text-muted-foreground';
  if (percentage >= 100) return 'text-destructive';
  if (percentage >= 75) return 'text-orange-500';
  return 'text-green-600';
}

type TrendView = 'daily' | 'weekly';

export default function Analytics() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trendView, setTrendView] = useState<TrendView>('daily');
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [showFilters, setShowFilters] = useState(false);

  // Data states
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const { categories: budgetCategories, totalBudget } = useBudgetData(month, year);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [cats, modes, exps] = await Promise.all([
          getCategories(),
          getPaymentModes(),
          getExpenses(),
        ]);
        setAllCategories(cats);
        setPaymentModes(modes);
        setExpenses(exps);
      } catch (error) {
        console.error('Failed to load analytics data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const paymentModeMap = useMemo(() => {
    const map: Record<string, string> = {};
    paymentModes.forEach(pm => {
      map[pm.id] = pm.name;
    });
    return map;
  }, [paymentModes]);

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    // Reset date range when month changes
    setDateRange({});
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    // Reset date range when month changes
    setDateRange({});
  };

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy');
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  // Get filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expenseDate = parseISO(e.date);
      
      // Month filter (always applied)
      if (!isWithinInterval(expenseDate, { start: monthStart, end: monthEnd })) {
        return false;
      }
      
      // Category filter
      if (selectedCategory !== 'all' && e.categoryId !== selectedCategory) {
        return false;
      }
      
      // Payment mode filter
      if (selectedPaymentMode !== 'all' && e.paymentModeId !== selectedPaymentMode) {
        return false;
      }
      
      // Date range filter
      if (dateRange.from && expenseDate < dateRange.from) {
        return false;
      }
      if (dateRange.to && expenseDate > dateRange.to) {
        return false;
      }
      
      return true;
    });
  }, [expenses, month, year, selectedCategory, selectedPaymentMode, dateRange, monthStart, monthEnd]);

  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = totalBudget - totalSpent;
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Prepare chart data - grouped by category
  const chartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    
    filteredExpenses.forEach((e) => {
      categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] || 0) + e.amount;
    });

    return Object.entries(categoryTotals)
      .map(([categoryId, value], index) => {
        const category = allCategories.find((c) => c.id === categoryId);
        return {
          name: category?.name || 'Unknown',
          value,
          icon: category?.icon || '📦',
          color: COLORS[index % COLORS.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, allCategories]);

  // Expense trends data
  const trendData = useMemo(() => {
    if (trendView === 'daily') {
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      return days.map((day) => {
        const dayExpenses = filteredExpenses.filter((e) => isSameDay(parseISO(e.date), day));
        const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
        return {
          label: format(day, 'd'),
          amount: total,
        };
      });
    } else {
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
      return weeks.map((weekStart, index) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekExpenses = filteredExpenses.filter((e) => {
          const expenseDate = parseISO(e.date);
          return isWithinInterval(expenseDate, { start: weekStart, end: weekEnd });
        });
        const total = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
        return {
          label: `W${index + 1}`,
          amount: total,
        };
      });
    }
  }, [filteredExpenses, trendView, monthStart, monthEnd]);

  // Expenses grouped by payment mode
  const paymentModeData = useMemo(() => {
    const modeTotals: Record<string, number> = {};
    
    filteredExpenses.forEach((e) => {
      modeTotals[e.paymentModeId] = (modeTotals[e.paymentModeId] || 0) + e.amount;
    });

    return Object.entries(modeTotals)
      .map(([modeId, value]) => ({
        name: paymentModeMap[modeId] || 'Unknown',
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, paymentModeMap]);


  const hasActiveFilters = selectedCategory !== 'all' || selectedPaymentMode !== 'all' || dateRange.from || dateRange.to;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedPaymentMode('all');
    setDateRange({});
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 pb-6">
        {/* Header with month navigation */}
        <div className="flex items-center justify-between pt-6">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2">
          <Button 
            variant={showFilters ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-xs text-primary">
                {[selectedCategory !== 'all', selectedPaymentMode !== 'all', dateRange.from || dateRange.to].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
              {/* Category Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All categories</SelectItem>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Mode Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Payment Mode</label>
                <Select value={selectedPaymentMode} onValueChange={setSelectedPaymentMode}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All modes" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All modes</SelectItem>
                    {paymentModes.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id}>
                        {mode.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start text-left font-normal">
                      {dateRange.from ? (
                        dateRange.to ? (
                          <span className="text-xs">
                            {format(dateRange.from, 'd MMM')} - {format(dateRange.to, 'd MMM')}
                          </span>
                        ) : (
                          <span className="text-xs">From {format(dateRange.from, 'd MMM')}</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Select dates</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                      defaultMonth={new Date(year, month - 1)}
                      disabled={(date) => date < monthStart || date > monthEnd}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-lg font-bold">{formatCurrency(totalBudget)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Left</p>
              <p className={`text-lg font-bold ${getStatusColor(percentage, totalBudget > 0)}`}>
                {formatCurrency(remaining)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Expense Trends */}
        {trendData.some((d) => d.amount > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Expense Trends</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={trendView === 'daily' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setTrendView('daily')}
                  >
                    Daily
                  </Button>
                  <Button
                    variant={trendView === 'weekly' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setTrendView('weekly')}
                  >
                    Weekly
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                      interval={trendView === 'daily' ? 4 : 0}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      width={40}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Spent']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pie Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2">
                {chartData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.icon} {item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


        {/* Spending by Payment Mode */}
        {paymentModeData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spending by Payment Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentModeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      type="number" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false} 
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Spent']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {filteredExpenses.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No expenses for this period</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

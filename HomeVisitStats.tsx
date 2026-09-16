import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  Users,
  CalendarDays,
  FileText,
  TrendingUp,
  BarChart3,
  PieChart,
  ListChecks,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import type {
  GradeStatsItem,
  CategoryStatsItem,
  FormStatsItem,
  StatsOverview,
  UserRole,
} from '@shared/api.interface';
import * as statsApi from '@client/src/api/stats';

interface MonthlyTrendItem {
  month: string;
  count: number;
}

interface HomeVisitStatsProps {
  role: UserRole;
}

const CHART_COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  purple: '#722ed1',
};

function getRecentMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const HomeVisitStats: React.FC<HomeVisitStatsProps> = ({ role }) => {
  const showGradeStats = role === 'admin' || role === 'school_leader';
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeStatsItem[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStatsItem[]>([]);
  const [formStats, setFormStats] = useState<FormStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthOptions = getRecentMonths(12);

  useEffect(() => {
    let cancelled = false;

    async function fetchData(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, trendRes, categoryRes, formRes, gradeRes] =
          await Promise.all([
            statsApi.getOverview(),
            statsApi.getMonthlyTrend(),
            statsApi.getCategoryStats({ month: selectedMonth }),
            statsApi.getFormStats({ month: selectedMonth }),
            showGradeStats ? statsApi.getGradeStats(selectedMonth) : Promise.resolve([]),
          ]);

        if (cancelled) return;

        setOverview(overviewRes);
        setMonthlyTrend(trendRes);
        setCategoryStats(categoryRes);
        setFormStats(formRes);
        if (showGradeStats) setGradeStats(gradeRes);
      } catch (err) {
        if (cancelled) return;
        console.error('获取统计数据失败', err);
        setError('数据加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, showGradeStats]);

  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['家访次数'] },
    grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: monthlyTrend.map((item) => item.month),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '家访次数',
        type: 'line',
        smooth: true,
        data: monthlyTrend.map((item) => item.count),
        lineStyle: { color: CHART_COLORS.primary, width: 2 },
        itemStyle: { color: CHART_COLORS.primary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#1677ff40' },
              { offset: 1, color: '#1677ff05' },
            ],
          },
        },
      },
    ],
  };

  const gradeOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['家访次数'] },
    grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: {
      type: 'category',
      data: gradeStats.map((item) => item.gradeLabel),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '家访次数',
        type: 'bar',
        barWidth: '40%',
        data: gradeStats.map((item, index) => ({
          value: item.count,
          itemStyle: {
            color: [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning][index % 3],
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  };

  const categoryOption: EChartsOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        name: '家访类别',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: false } },
        data: categoryStats.map((item, index) => ({
          name: item.categoryLabel,
          value: item.count,
          itemStyle: {
            color: [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning][index % 3],
          },
        })),
      },
    ],
  };

  const formOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['家访次数'] },
    grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: {
      type: 'category',
      data: formStats.map((item) => item.formLabel),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '家访次数',
        type: 'bar',
        barWidth: '40%',
        data: formStats.map((item, index) => ({
          value: item.count,
          itemStyle: {
            color: [
              CHART_COLORS.primary,
              CHART_COLORS.success,
              CHART_COLORS.warning,
              CHART_COLORS.purple,
            ][index % 4],
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  };

  const statCards = [
    {
      title: '总家访次数',
      value: overview?.totalRecords ?? 0,
      icon: FileText,
      color: CHART_COLORS.primary,
    },
    {
      title: '本月家访次数',
      value: overview?.thisMonthRecords ?? 0,
      icon: CalendarDays,
      color: CHART_COLORS.success,
    },
    {
      title: '涉及学生数',
      value: overview?.totalStudents ?? 0,
      icon: Users,
      color: CHART_COLORS.warning,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-base font-medium text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部筛选栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">数据统计</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === 'admin' || role === 'school_leader'
              ? '全校家访数据统计与可视化分析'
              : role === 'grade_head' || role === 'grade_director'
                ? '本年级家访数据统计与可视化分析'
                : '本班家访数据统计与可视化分析'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">月份筛选：</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-ai-section-type="card-stat">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="border-border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
                    <p className="text-2xl font-semibold text-foreground">{card.value}</p>
                  </div>
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${card.color}15` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: card.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 月度趋势图 */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            月度家访趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyTrend.length > 0 ? (
            <ReactECharts option={trendOption} theme="ud" className="h-[300px] w-full" />
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm text-muted-foreground">暂无趋势数据</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 年级统计 / 类别分布 */}
      {showGradeStats ? (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              各年级家访统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gradeStats.length > 0 && gradeStats.some((g) => g.count > 0) ? (
              <ReactECharts option={gradeOption} theme="ud" className="h-[300px] w-full" />
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">暂无年级统计数据</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              本班家访类别分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryStats.length > 0 && categoryStats.some((c) => c.count > 0) ? (
              <ReactECharts option={categoryOption} theme="ud" className="h-[300px] w-full" />
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <PieChart className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">暂无类别统计数据</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 类别统计 + 形式统计并排 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {showGradeStats && (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                家访类别分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryStats.length > 0 && categoryStats.some((c) => c.count > 0) ? (
                <ReactECharts
                  option={categoryOption}
                  theme="ud"
                  className="h-[300px] w-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <PieChart className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm text-muted-foreground">暂无类别统计数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              家访形式统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {formStats.length > 0 && formStats.some((f) => f.count > 0) ? (
              <ReactECharts option={formOption} theme="ud" className="h-[300px] w-full" />
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">暂无形式统计数据</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HomeVisitStats;

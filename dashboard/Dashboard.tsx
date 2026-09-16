import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  Users,
  UserCheck,
  GraduationCap,
  School,
  TrendingUp,
  TrendingDown,
  FileText,
  UserPlus,
  Upload,
  BarChart3,
  Calendar,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { useCurrentUser } from '@client/src/hooks/useCurrentUser';

import { stats } from '@client/src/api';
import type { GradeStatsItem, StatsOverview, Grade } from '@shared/api.interface';
import { GRADE_LABELS } from '@shared/api.interface';

interface MonthlyTrendItem {
  month: string;
  count: number;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-2xl font-semibold text-foreground mt-0.5">{value}</div>
      </div>
    </CardContent>
  </Card>
);

interface QuickEntry {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  path: string;
}

const adminQuickEntries: QuickEntry[] = [
  { label: '家访记录', icon: FileText, color: '#1677ff', path: '/records' },
  { label: '班主任管理', icon: UserPlus, color: '#52c41a', path: '/teachers' },
  { label: '学生管理', icon: GraduationCap, color: '#faad14', path: '/students' },
  { label: '名单导入', icon: Upload, color: '#722ed1', path: '/import' },
  { label: '数据统计', icon: BarChart3, color: '#13c2c2', path: '/stats' },
];

const Dashboard: React.FC = () => {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const role = user?.role;

  const isAdmin = role === 'admin';
  const isSchoolLeader = role === 'school_leader';
  const isGradeLevel = role === 'grade_head' || role === 'grade_director';
  const isTeacher = role === 'teacher';
  const isSystemAdmin = isAdmin;
  const hasFullAccess = isAdmin || isSchoolLeader;
  const showGradeChart = hasFullAccess;

  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastMonthCount, setLastMonthCount] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const requests: Promise<unknown>[] = [
          stats.getOverview(),
          stats.getMonthlyTrend(),
        ];
        if (showGradeChart) {
          requests.push(stats.getGradeStats());
        }
        const [overviewData, trendData, gradeData] = await Promise.all(requests);
        setOverview(overviewData as StatsOverview);
        setMonthlyTrend(trendData as MonthlyTrendItem[]);
        if (showGradeChart && gradeData) {
          setGradeStats(gradeData as GradeStatsItem[]);
        }

        const trend = trendData as MonthlyTrendItem[];
        if (trend.length >= 2) {
          setLastMonthCount(trend[trend.length - 2].count);
        }
      } catch (error) {
        console.error('加载仪表盘数据失败', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [showGradeChart]);

  const thisMonthRecords = overview?.thisMonthRecords ?? 0;
  const diff = thisMonthRecords - lastMonthCount;
  const diffPercent =
    lastMonthCount > 0
      ? ((diff / lastMonthCount) * 100).toFixed(1)
      : thisMonthRecords > 0
        ? '100.0'
        : '0.0';

  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['家访次数'] },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
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
        areaStyle: {
          color: '#1677ff',
          opacity: 0.1,
        },
        lineStyle: {
          color: '#1677ff',
          width: 2,
        },
        itemStyle: {
          color: '#1677ff',
        },
      },
    ],
  };

  const gradeOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['家访次数'] },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: gradeStats.map((item) => item.gradeLabel || GRADE_LABELS[item.grade]),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '家访次数',
        type: 'bar',
        data: gradeStats.map((item) => item.count),
        itemStyle: {
          color: '#52c41a',
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '40%',
      },
    ],
  };

  const getSubtitle = (): string => {
    if (isAdmin || isSchoolLeader) return '全校家访数据概览与关键指标';
    if (isGradeLevel && user?.grade) {
      return `${GRADE_LABELS[user.grade]}家访数据概览`;
    }
    if (isTeacher && user?.grade && user.className) {
      return `${GRADE_LABELS[user.grade]}${user.className} 家访数据概览`;
    }
    return '家访数据概览';
  };

  const quickActions: { label: string; icon: React.ComponentType<{ className?: string }>; path: string }[] = [
    { label: '家访记录管理', icon: ClipboardList, path: '/records' },
    { label: '查看数据统计', icon: BarChart3, path: '/stats' },
    { label: '新增家访记录', icon: Plus, path: '/records' },
  ];

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-semibold text-foreground">首页概览</h1>
          <p className="text-sm text-muted-foreground mt-1">{getSubtitle()}</p>
        </div>
        {(isTeacher || isGradeLevel) && (
          <Button onClick={() => navigate('/records')}>
            <Plus className="w-4 h-4 mr-2" />
            新增家访记录
          </Button>
        )}
      </div>

      {/* 顶部数据概览卡片 */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-ai-section-type="card-stat"
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))
        ) : hasFullAccess ? (
          <>
            <StatCard
              title="总家访次数"
              value={overview?.totalRecords ?? 0}
              icon={<FileText className="w-6 h-6" />}
              color="#1677ff"
            />
            <StatCard
              title="班主任总数"
              value={overview?.totalTeachers ?? 0}
              icon={<UserCheck className="w-6 h-6" />}
              color="#52c41a"
            />
            <StatCard
              title="学生总数"
              value={overview?.totalStudents ?? 0}
              icon={<GraduationCap className="w-6 h-6" />}
              color="#faad14"
            />
            <StatCard
              title="班级总数"
              value={overview?.totalClasses ?? 0}
              icon={<School className="w-6 h-6" />}
              color="#722ed1"
            />
          </>
        ) : (
          <>
            <StatCard
              title="总家访次数"
              value={overview?.totalRecords ?? 0}
              icon={<FileText className="w-6 h-6" />}
              color="#1677ff"
            />
            <StatCard
              title="本月家访次数"
              value={overview?.thisMonthRecords ?? 0}
              icon={<Calendar className="w-6 h-6" />}
              color="#52c41a"
            />
            <StatCard
              title={isGradeLevel ? '本年级学生数' : '本班学生数'}
              value={overview?.totalStudents ?? 0}
              icon={<Users className="w-6 h-6" />}
              color="#faad14"
            />
            <StatCard
              title="累计家访记录"
              value={overview?.totalRecords ?? 0}
              icon={<ClipboardList className="w-6 h-6" />}
              color="#722ed1"
            />
          </>
        )}
      </div>

      {/* 中部区域 */}
      {hasFullAccess ? (
        <>
          {/* 本月数据 + 快速入口 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border shadow-sm lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">本月家访次数</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="text-4xl font-bold text-foreground">
                      {thisMonthRecords}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {diff >= 0 ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-success" />
                          <span className="text-success">
                            较上月 +{diffPercent}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-4 h-4 text-destructive" />
                          <span className="text-destructive">
                            较上月 {diffPercent}%
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground">
                        （上月 {lastMonthCount} 次）
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  {isSystemAdmin ? '快速入口' : '快捷操作'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isSystemAdmin ? (
                  <div
                    className="grid grid-cols-3 sm:grid-cols-5 gap-3"
                    data-ai-section-type="card-menu"
                  >
                    {adminQuickEntries.map((entry) => {
                      const Icon = entry.icon;
                      return (
                        <Button
                          key={entry.label}
                          variant="outline"
                          className="flex flex-col items-center justify-center h-20 gap-2"
                          onClick={() => navigate(entry.path)}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{ color: entry.color }}
                          />
                          <span className="text-xs">{entry.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Button
                          key={action.label}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => navigate(action.path)}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 底部图表：月度趋势 + 年级统计 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">月度家访趋势</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : monthlyTrend.length === 0 ? (
                  <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                    <Users className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">暂无数据</p>
                  </div>
                ) : (
                  <ReactECharts
                    option={trendOption}
                    theme="ud"
                    className="h-[300px] w-full"
                  />
                )}
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">各年级家访次数</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : gradeStats.length === 0 ? (
                  <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                    <Users className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">暂无数据</p>
                  </div>
                ) : (
                  <ReactECharts
                    option={gradeOption}
                    theme="ud"
                    className="h-[300px] w-full"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                月度家访趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : monthlyTrend.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                  <Users className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">暂无数据</p>
                </div>
              ) : (
                <ReactECharts
                  option={trendOption}
                  theme="ud"
                  className="h-[300px] w-full"
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                快捷操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(action.path)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {action.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

import React, { useState } from 'react';
import { Upload } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@client/src/components/ui/tabs';

import TeacherImportPanel from './TeacherImportPanel';
import StudentImportPanel from './StudentImportPanel';

const Import: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('teachers');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">名单导入</h1>
        <p className="text-sm text-muted-foreground mt-1">批量导入班主任和学生名单</p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            批量导入
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="teachers">班主任名单导入</TabsTrigger>
              <TabsTrigger value="students">学生名单导入</TabsTrigger>
            </TabsList>

            <TabsContent value="teachers" className="mt-4">
              <TeacherImportPanel />
            </TabsContent>

            <TabsContent value="students" className="mt-4">
              <StudentImportPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Import;

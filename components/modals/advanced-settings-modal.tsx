'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Info, Bell, Mail, CheckSquare, Mic, DollarSign } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdvancedSettingsModal({
  isOpen,
  onClose,
}: AdvancedSettingsModalProps) {
  const t = useTranslations('modalsAdvancedSettingsModal');
  const [activeTab, setActiveTab] = React.useState('notifications');

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('emailNotifications')}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('emailNotificationsTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('pushNotifications')}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('pushNotificationsTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {t('notificationFrequency')}
          </span>
        </div>
        <Select defaultValue="immediate">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('selectFrequency')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">{t('frequencyImmediate')}</SelectItem>
            <SelectItem value="hourly">{t('frequencyHourly')}</SelectItem>
            <SelectItem value="daily">{t('frequencyDaily')}</SelectItem>
            <SelectItem value="weekly">{t('frequencyWeekly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderEmailsTab = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('welcomeEmailTemplate')}
        </label>
        <Textarea
          placeholder={t('welcomeEmailPlaceholder')}
          className="min-h-[150px]"
          defaultValue={t('welcomeEmailDefault')}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('followUpEmailTemplate')}
        </label>
        <Textarea
          placeholder={t('followUpEmailPlaceholder')}
          className="min-h-[150px]"
          defaultValue={t('followUpEmailDefault')}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('emailBranding')}</span>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  );

  const renderTasksTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {t('enableTaskAssignment')}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('enableTaskAssignmentTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('taskReminders')}</span>
        </div>
        <Switch />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('defaultTaskDueDate')}</label>
        <Input type="number" defaultValue="7" min="1" max="30" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('taskCategories')}</label>
        <Textarea
          placeholder={t('taskCategoriesPlaceholder')}
          className="min-h-[100px]"
          defaultValue="Reading\nAssignment\nQuiz\nProject\nResearch"
        />
      </div>
    </div>
  );

  const renderVoiceTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {t('enableVoiceInteraction')}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('enableVoiceInteractionTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('voiceType')}</label>
        <Select defaultValue="neutral">
          <SelectTrigger>
            <SelectValue placeholder={t('selectVoiceType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="neutral">{t('voiceNeutral')}</SelectItem>
            <SelectItem value="friendly">{t('voiceFriendly')}</SelectItem>
            <SelectItem value="professional">
              {t('voiceProfessional')}
            </SelectItem>
            <SelectItem value="enthusiastic">
              {t('voiceEnthusiastic')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('speechRate')}</label>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{t('slow')}</span>
          <Input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            defaultValue="1"
            className="flex-1"
          />
          <span className="text-sm text-gray-500">{t('fast')}</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('voiceRecognitionSensitivity')}
        </label>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{t('low')}</span>
          <Input
            type="range"
            min="0"
            max="1"
            step="0.1"
            defaultValue="0.5"
            className="flex-1"
          />
          <span className="text-sm text-gray-500">{t('high')}</span>
        </div>
      </div>
    </div>
  );

  const renderMonetizationTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('enablePaidAccess')}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('enablePaidAccessTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('pricingModel')}</label>
        <Select defaultValue="subscription">
          <SelectTrigger>
            <SelectValue placeholder={t('selectPricingModel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscription">
              {t('pricingSubscription')}
            </SelectItem>
            <SelectItem value="one-time">{t('pricingOneTime')}</SelectItem>
            <SelectItem value="usage">{t('pricingUsageBased')}</SelectItem>
            <SelectItem value="freemium">{t('pricingFreemium')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('price')}</label>
          <Input type="number" defaultValue="9.99" min="0" step="0.01" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('billingCycle')}</label>
          <Select defaultValue="monthly">
            <SelectTrigger>
              <SelectValue placeholder={t('selectBillingCycle')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">{t('billingMonthly')}</SelectItem>
              <SelectItem value="quarterly">{t('billingQuarterly')}</SelectItem>
              <SelectItem value="annually">{t('billingAnnually')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('freeTrialPeriod')}</label>
        <Input type="number" defaultValue="7" min="0" max="90" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('paymentProcessors')}</label>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Switch id="stripe" defaultChecked />
            <label htmlFor="stripe" className="text-sm">
              {t('stripe')}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="paypal" />
            <label htmlFor="paypal" className="text-sm">
              {t('paypal')}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="apple-pay" />
            <label htmlFor="apple-pay" className="text-sm">
              {t('applePay')}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="google-pay" />
            <label htmlFor="google-pay" className="text-sm">
              {t('googlePay')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="800px">
      <div className="max-h-[80vh] space-y-6 overflow-y-auto p-6">
        {' '}
        {/* Added p-6 for consistent margins */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#646464]">{t('title')}</h2>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start gap-2 overflow-x-auto bg-transparent p-0">
            <TabsTrigger
              value="notifications"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <Bell className="mr-2 h-4 w-4" />
              {t('tabNotifications')}
            </TabsTrigger>
            <TabsTrigger
              value="emails"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <Mail className="mr-2 h-4 w-4" />
              {t('tabEmails')}
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              {t('tabTasks')}
            </TabsTrigger>
            <TabsTrigger
              value="voice"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <Mic className="mr-2 h-4 w-4" />
              {t('tabVoice')}
            </TabsTrigger>
            <TabsTrigger
              value="monetization"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              {t('tabMonetization')}
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="notifications">
              {renderNotificationsTab()}
            </TabsContent>
            <TabsContent value="emails">{renderEmailsTab()}</TabsContent>
            <TabsContent value="tasks">{renderTasksTab()}</TabsContent>
            <TabsContent value="voice">{renderVoiceTab()}</TabsContent>
            <TabsContent value="monetization">
              {renderMonetizationTab()}
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex justify-end p-6 pt-4">
          {' '}
          {/* Added p-6 for consistent margins */}
          <Button variant="outline" className="mr-2" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90">
            {t('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

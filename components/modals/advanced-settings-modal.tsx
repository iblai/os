'use client';

import * as React from 'react';
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
  const [activeTab, setActiveTab] = React.useState('notifications');

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Email Notifications</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Send email notifications for new messages</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Push Notifications</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Enable browser push notifications</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Notification Frequency</span>
        </div>
        <Select defaultValue="immediate">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">Immediate</SelectItem>
            <SelectItem value="hourly">Hourly Digest</SelectItem>
            <SelectItem value="daily">Daily Digest</SelectItem>
            <SelectItem value="weekly">Weekly Digest</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderEmailsTab = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Welcome Email Template</label>
        <Textarea
          placeholder="Enter welcome email template"
          className="min-h-[150px]"
          defaultValue="Welcome to our platform! We're excited to have you join us. Your agent is now ready to assist you with any questions you might have."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Follow-up Email Template</label>
        <Textarea
          placeholder="Enter follow-up email template"
          className="min-h-[150px]"
          defaultValue="How has your experience been with your agent? We'd love to hear your feedback to help improve our service."
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Email Branding</span>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  );

  const renderTasksTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Enable Task Assignment</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Allow agent to assign tasks to users</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Task Reminders</span>
        </div>
        <Switch />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Default Task Due Date (days)
        </label>
        <Input type="number" defaultValue="7" min="1" max="30" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Task Categories</label>
        <Textarea
          placeholder="Enter task categories (one per line)"
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
          <span className="text-sm font-medium">Enable Voice Interaction</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Allow users to interact with agent using voice</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Voice Type</label>
        <Select defaultValue="neutral">
          <SelectTrigger>
            <SelectValue placeholder="Select voice type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Speech Rate</label>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Slow</span>
          <Input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            defaultValue="1"
            className="flex-1"
          />
          <span className="text-sm text-gray-500">Fast</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Voice Recognition Sensitivity
        </label>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Low</span>
          <Input
            type="range"
            min="0"
            max="1"
            step="0.1"
            defaultValue="0.5"
            className="flex-1"
          />
          <span className="text-sm text-gray-500">High</span>
        </div>
      </div>
    </div>
  );

  const renderMonetizationTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Enable Paid Access</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Require payment for access to this agent</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Pricing Model</label>
        <Select defaultValue="subscription">
          <SelectTrigger>
            <SelectValue placeholder="Select pricing model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscription">Subscription</SelectItem>
            <SelectItem value="one-time">One-time Purchase</SelectItem>
            <SelectItem value="usage">Usage-based</SelectItem>
            <SelectItem value="freemium">Freemium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Price ($)</label>
          <Input type="number" defaultValue="9.99" min="0" step="0.01" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Billing Cycle</label>
          <Select defaultValue="monthly">
            <SelectTrigger>
              <SelectValue placeholder="Select billing cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Free Trial Period (days)</label>
        <Input type="number" defaultValue="7" min="0" max="90" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Payment Processors</label>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Switch id="stripe" defaultChecked />
            <label htmlFor="stripe" className="text-sm">
              Stripe
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="paypal" />
            <label htmlFor="paypal" className="text-sm">
              PayPal
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="apple-pay" />
            <label htmlFor="apple-pay" className="text-sm">
              Apple Pay
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="google-pay" />
            <label htmlFor="google-pay" className="text-sm">
              Google Pay
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
          <h2 className="text-xl font-semibold text-[#646464]">
            Advanced Settings
          </h2>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start gap-2 overflow-x-auto bg-transparent p-0">
            <TabsTrigger
              value="notifications"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger
              value="emails"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <Mail className="mr-2 h-4 w-4" />
              Emails
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="voice"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <Mic className="mr-2 h-4 w-4" />
              Voice
            </TabsTrigger>
            <TabsTrigger
              value="monetization"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Monetization
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
            Cancel
          </Button>
          <Button className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90">
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

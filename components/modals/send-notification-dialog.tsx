'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Search, Send, X, Calendar, Clock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SendNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotificationSent?: (notification: any) => void;
  preSelectedUser?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

// Mock users data
const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com', avatar: '/diverse-user-avatars.png' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', avatar: '/diverse-user-avatars.png' },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', avatar: '/diverse-user-avatars.png' },
  {
    id: '4',
    name: 'Sarah Williams',
    email: 'sarah@example.com',
    avatar: '/diverse-user-avatars.png',
  },
  { id: '5', name: 'David Brown', email: 'david@example.com', avatar: '/diverse-user-avatars.png' },
  { id: '6', name: 'Emily Davis', email: 'emily@example.com', avatar: '/diverse-user-avatars.png' },
];

export function SendNotificationDialog({
  open,
  onOpenChange,
  onNotificationSent,
  preSelectedUser,
}: SendNotificationDialogProps) {
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendType, setSendType] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('12:00');

  useEffect(() => {
    if (open && preSelectedUser && !selectedUsers.includes(preSelectedUser.id)) {
      setSelectedUsers([preSelectedUser.id]);
    }
  }, [open, preSelectedUser]);

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSendNotification = () => {
    const scheduledDateTime =
      sendType === 'schedule' && scheduledDate
        ? new Date(`${format(scheduledDate, 'yyyy-MM-dd')}T${scheduledTime}`)
        : undefined;

    const newNotification = {
      id: `notif-${Date.now()}`,
      title: notificationTitle,
      preview: notificationTitle,
      body: notificationBody,
      timestamp: new Date(),
      scheduledFor: scheduledDateTime,
      read: false,
      type: 'custom',
      status: sendType === 'schedule' ? 'scheduled' : 'sent',
      recipients: selectedUsers,
    };

    if (onNotificationSent) {
      onNotificationSent(newNotification);
    }

    setNotificationTitle('');
    setNotificationBody('');
    setSelectedUsers([]);
    setSendType('now');
    setScheduledDate(undefined);
    setScheduledTime('12:00');
    onOpenChange(false);
  };

  const handleClose = () => {
    setNotificationTitle('');
    setNotificationBody('');
    setSelectedUsers([]);
    setSearchQuery('');
    setSendType('now');
    setScheduledDate(undefined);
    setScheduledTime('12:00');
    onOpenChange(false);
  };

  const isFormValid =
    notificationTitle.trim() !== '' &&
    notificationBody.trim() !== '' &&
    selectedUsers.length > 0 &&
    (sendType === 'now' || (sendType === 'schedule' && scheduledDate));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">Send New Notification</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto px-1">
            <div className="space-y-6 pr-4">
              <div className="space-y-2 mt-3">
                <Label htmlFor="notification-title" className="text-sm font-medium">
                  Preview
                </Label>
                <Input
                  id="notification-title"
                  placeholder="Enter notification preview text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification-body" className="text-sm font-medium">
                  Body
                </Label>
                <RichTextEditor value={notificationBody} onChange={setNotificationBody} />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Send Time</Label>
                <RadioGroup
                  value={sendType}
                  onValueChange={(value) => setSendType(value as 'now' | 'schedule')}
                >
                  <div className="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="now" id="send-now" />
                    <Label htmlFor="send-now" className="font-normal cursor-pointer">
                      Send immediately
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="schedule" id="send-schedule" />
                    <Label htmlFor="send-schedule" className="font-normal cursor-pointer">
                      Schedule for later
                    </Label>
                  </div>
                </RadioGroup>

                {sendType === 'schedule' && (
                  <div className="flex gap-3 mt-4 pl-6">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'justify-start text-left font-normal min-w-[200px]',
                            !scheduledDate && 'text-muted-foreground',
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-2 min-w-[140px]">
                      <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Select Recipients</Label>
                  <span className="text-sm text-gray-500">
                    {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    {selectedUsers.map((userId) => {
                      const user = mockUsers.find((u) => u.id === userId);
                      if (!user) return null;
                      return (
                        <div
                          key={userId}
                          className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-blue-200"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user.avatar || '/placeholder.svg'} alt={user.name} />
                            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                              {user.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-gray-900">{user.name}</span>
                          <button
                            onClick={() => toggleUserSelection(userId)}
                            className="hover:bg-gray-100 rounded-full p-0.5 transition-colors"
                          >
                            <X className="h-3 w-3 text-gray-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="max-h-[280px] overflow-y-auto space-y-2 border rounded-lg p-2">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedUsers.includes(user.id)
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar || '/placeholder.svg'} alt={user.name} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                            {user.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                        {selectedUsers.includes(user.id) && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M5 13l4 4L19 7"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">No users found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSendNotification}
            disabled={!isFormValid}
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] hover:opacity-90 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendType === 'now' ? 'Send Now' : 'Schedule Notification'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

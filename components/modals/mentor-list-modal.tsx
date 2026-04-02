'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Mentor {
  id: string;
  name: string;
  description: string;
  avatar: string;
  fallback: string;
}

const mentors: Mentor[] = [
  {
    id: '1',
    name: 'Abilene Christian University',
    description:
      'Abilene Christian University | ibl.ai AI Mentor Trained on Public University Data',
    avatar: '/placeholder.svg',
    fallback: 'ACU',
  },
  {
    id: '2',
    name: 'Accelerated Computing Agent',
    description:
      'Mentor trained on academic papers, technical blogs, and online courses on accelerated computing.',
    avatar: '/placeholder.svg',
    fallback: 'AC',
  },
  {
    id: '3',
    name: 'Adelphi University',
    description:
      'Adelphi University | ibl.ai AI Mentor Trained on Public University Data',
    avatar: '/placeholder.svg',
    fallback: 'AU',
  },
  {
    id: '4',
    name: 'AI Agent',
    description: 'Language Models, Unleashed.',
    avatar: '/placeholder.svg',
    fallback: 'AI',
  },
];

interface MentorListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mentor: Mentor) => void;
}

export function MentorListModal({
  isOpen,
  onClose,
  onSelect,
}: MentorListModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredMentors = React.useMemo(() => {
    return mentors.filter(
      (mentor) =>
        mentor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mentor.description.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="relative">
        <div className="sticky top-0 z-10 bg-white pb-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                type="search"
                placeholder="Search"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {filteredMentors.map((mentor) => (
            <button
              key={mentor.id}
              className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-gray-50"
              onClick={() => onSelect(mentor)}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={mentor.avatar} alt={mentor.name} />
                <AvatarFallback>{mentor.fallback}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-gray-900">
                  {mentor.name}
                </h3>
                <p className="truncate text-sm text-gray-500">
                  {mentor.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

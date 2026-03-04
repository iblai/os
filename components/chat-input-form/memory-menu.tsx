'use client';

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Search, Edit3, Trash2, Plus } from 'lucide-react';

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  category: string;
}

interface MemoryMenuProps {
  onClose: () => void;
  onSelectMemory: (memory: MemoryItem) => void;
  selectedMemories: MemoryItem[];
}

// Memory Menu Component
export const MemoryMenu = ({
  onClose,
  onSelectMemory,
  selectedMemories,
}: MemoryMenuProps) => {
  const [showAllMemories, setShowAllMemories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [editingMemory, setEditingMemory] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState({
    title: '',
    content: '',
    category: 'General',
  });
  const [editMemoryData, setEditMemoryData] = useState({
    title: '',
    content: '',
    category: '',
  });

  // Mock memory data - replace with actual data from your memory system
  const [memories, setMemories] = useState<MemoryItem[]>([
    {
      id: '1',
      title: 'JavaScript Fundamentals',
      content:
        'User is learning JavaScript basics, focusing on variables, functions, and loops',
      timestamp: '2 hours ago',
      category: 'Learning',
    },
    {
      id: '2',
      title: 'Code Project Setup',
      content:
        'Working on a React project with TypeScript, needs help with component structure',
      timestamp: '1 day ago',
      category: 'Development',
    },
    {
      id: '3',
      title: 'Career Goals',
      content:
        'Interested in becoming a full-stack developer, currently focusing on frontend',
      timestamp: '3 days ago',
      category: 'Career',
    },
    {
      id: '4',
      title: 'Study Schedule',
      content:
        'Prefers studying in the morning, works better with visual examples',
      timestamp: '1 week ago',
      category: 'Preferences',
    },
    {
      id: '5',
      title: 'Python Learning Path',
      content:
        'Started learning Python for data science, completed basic syntax',
      timestamp: '2 weeks ago',
      category: 'Learning',
    },
    {
      id: '6',
      title: 'Project Deadlines',
      content:
        'Has upcoming project deadline next month, needs time management help',
      timestamp: '3 weeks ago',
      category: 'Planning',
    },
  ]);

  const categories = [
    'General',
    'Learning',
    'Development',
    'Career',
    'Preferences',
    'Planning',
  ];

  const handleDeleteMemory = (memoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMemories(memories.filter((m) => m.id !== memoryId));
  };

  const handleMemoryClick = (memory: MemoryItem) => {
    if (editingMemory === memory.id) return;
    onSelectMemory(memory);
    onClose(); // Close the menu after selection
  };

  const handleAddMemory = () => {
    if (newMemory.title.trim() && newMemory.content.trim()) {
      const memory: MemoryItem = {
        id: Date.now().toString(),
        title: newMemory.title,
        content: newMemory.content,
        category: newMemory.category,
        timestamp: 'Just now',
      };
      setMemories([memory, ...memories]);
      setNewMemory({ title: '', content: '', category: 'General' });
      setIsAddingMemory(false);
    }
  };

  const handleEditMemory = (memory: MemoryItem) => {
    setEditingMemory(memory.id);
    setEditMemoryData({
      title: memory.title,
      content: memory.content,
      category: memory.category,
    });
  };

  const handleSaveEdit = (memoryId: string) => {
    setMemories(
      memories.map((m) =>
        m.id === memoryId
          ? {
              ...m,
              title: editMemoryData.title,
              content: editMemoryData.content,
              category: editMemoryData.category,
            }
          : m
      )
    );
    setEditingMemory(null);
    setEditMemoryData({ title: '', content: '', category: '' });
  };

  const filteredMemories = memories.filter(
    (memory) =>
      memory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Your Memory</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-[#38A1E5] hover:text-white"
              onClick={() => setIsAddingMemory(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-gray-100"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-8 text-sm border border-gray-300 rounded-md"
          />
        </div>

        <p className="text-sm text-gray-500 mt-2">
          Select memories to include in your conversation
        </p>
      </div>

      {/* Add Memory Form */}
      {isAddingMemory && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">Add New Memory</h4>
          <div className="space-y-3">
            <Input
              placeholder="Memory title..."
              value={newMemory.title}
              onChange={(e) =>
                setNewMemory({ ...newMemory, title: e.target.value })
              }
              className="h-8 text-sm border border-gray-300 rounded-md"
            />
            <Textarea
              placeholder="Memory content..."
              value={newMemory.content}
              onChange={(e) =>
                setNewMemory({ ...newMemory, content: e.target.value })
              }
              className="min-h-[60px] text-sm resize-none border border-gray-300 rounded-md"
            />
            <select
              value={newMemory.category}
              onChange={(e) =>
                setNewMemory({ ...newMemory, category: e.target.value })
              }
              className="w-full h-8 text-sm border border-gray-300 rounded-md px-2 bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddMemory}
                className="bg-[#38A1E5] hover:bg-[#2891D5] text-white"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddingMemory(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`${showAllMemories ? 'max-h-80' : 'max-h-64'} overflow-y-auto`}
      >
        {filteredMemories
          .slice(0, showAllMemories ? filteredMemories.length : 4)
          .map((memory) => {
            const isSelected = selectedMemories.some((m) => m.id === memory.id);
            const isEditing = editingMemory === memory.id;

            return (
              <div
                key={memory.id}
                className={`p-3 border-b border-gray-50 last:border-b-0 transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      value={editMemoryData.title}
                      onChange={(e) =>
                        setEditMemoryData({
                          ...editMemoryData,
                          title: e.target.value,
                        })
                      }
                      className="h-8 text-sm font-medium border border-gray-300 rounded-md"
                      placeholder="Memory title..."
                    />
                    <Textarea
                      value={editMemoryData.content}
                      onChange={(e) =>
                        setEditMemoryData({
                          ...editMemoryData,
                          content: e.target.value,
                        })
                      }
                      className="min-h-[60px] text-sm resize-none border border-gray-300 rounded-md"
                      placeholder="Memory content..."
                    />
                    <select
                      value={editMemoryData.category}
                      onChange={(e) =>
                        setEditMemoryData({
                          ...editMemoryData,
                          category: e.target.value,
                        })
                      }
                      className="w-full h-8 text-sm border border-gray-300 rounded-md px-2 bg-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(memory.id)}
                        className="bg-[#38A1E5] hover:bg-[#2891D5] text-white"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingMemory(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => handleMemoryClick(memory)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}
                          >
                            {memory.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              isSelected
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {memory.category}
                          </span>
                        </div>
                        <p
                          className={`text-xs mt-1 line-clamp-2 ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}
                        >
                          {memory.content}
                        </p>
                        <p
                          className={`text-xs mt-1 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
                        >
                          {memory.timestamp}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-blue-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMemory(memory);
                          }}
                        >
                          <Edit3 className="h-3 w-3 text-blue-500" />
                        </Button>
                        {showAllMemories && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-red-100"
                            onClick={(e) => handleDeleteMemory(memory.id, e)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {filteredMemories.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchQuery
              ? 'No memories found matching your search.'
              : 'No memories yet.'}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs bg-transparent"
          onClick={() => setShowAllMemories(!showAllMemories)}
        >
          {showAllMemories ? 'Show Less' : 'View All Memories'}
        </Button>
      </div>
    </>
  );
};

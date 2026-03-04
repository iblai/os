"use client";
import { X, PlayCircle, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "react-responsive";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const helpResources = [
  {
    title: "Create A Study Buddy Mentor",
    icon: PlayCircle,
  },
  {
    title: "Teaching Assistant Mentor",
    icon: PlayCircle,
  },
  {
    title: "Lesson Planner",
    icon: PlayCircle,
  },
  {
    title: "Training From a Website",
    icon: PlayCircle,
  },
  {
    title: "Multi-language Support",
    icon: PlayCircle,
  },
  {
    title: "Customer Support",
    icon: PlayCircle,
  },
  {
    title: "Exploring Course Subjects and Topics",
    icon: PlayCircle,
  },
];

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={`${isMobile ? "h-full w-full" : "w-[400px]"}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b py-1.5">
          <h2 className="text-xl font-semibold">Help</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="py-4">
            <h3 className="mb-4 text-sm font-medium text-gray-500">
              Popular Resources
            </h3>
            <div className="space-y-1">
              {helpResources.map((resource, index) => (
                <button
                  key={index}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-gray-100"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                    <resource.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">
                    {resource.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t">
          <button className="flex w-full items-center gap-3 p-4 transition-colors hover:bg-gray-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <AlertCircle className="h-5 w-5 text-gray-600" />
            </div>
            <span className="text-sm text-blue-600">Report a problem</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

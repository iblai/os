"use client";

import { useEffect, useState } from "react";
import { AddResourceModal } from "@/components/modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal";

export function AddResourceListener() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenModal = () => {
      setIsModalOpen(true);
    };

    // Add event listener for the custom event
    window.addEventListener("openAddResourceModal", handleOpenModal);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("openAddResourceModal", handleOpenModal);
    };
  }, []);

  return (
    <AddResourceModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
    />
  );
}

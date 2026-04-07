import { ResourceType } from '../resource-types';
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
} from '@/components/ui/dialog';
import { GithubFileUploadModal } from './github-file-upload-modal';
import { LocalFileUploadModal } from './local-file-upload-modal';
import { UrlUploadModal } from './url-upload-model';
import { WebsiteCrawlModal } from './website-crawl-modal';

type Props = {
  resource: ResourceType;
  isOpen: boolean;
  onClose: () => void;
};

export function ResourceModal({ resource, isOpen, onClose }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="text-muted-foreground text-base">
            {resource.name}
          </DialogTitle>
        </DialogHeader>
        {resource.type === 'github' && <GithubFileUploadModal />}
        {resource.type === 'local' && (
          <LocalFileUploadModal resource={resource} />
        )}
        {resource.type === 'webcrawler' && (
          <WebsiteCrawlModal resource={resource} />
        )}
        {resource.type === 'url' && <UrlUploadModal resource={resource} />}
      </DialogContent>
    </Dialog>
  );
}

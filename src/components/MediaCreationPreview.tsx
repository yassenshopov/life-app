'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MediaCreationPreviewProps {
  title?: string;
  description?: string;
  authors?: string[];
  thumbnailUrl?: string;
  category?: string;
  status?: string;
  isVisible: boolean;
  isEditable?: boolean;
  onTitleChange?: (title: string) => void;
  onDescriptionChange?: (description: string) => void;
  onStatusChange?: (status: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

// Typed text animation component
function TypedText({ text, delay = 0, className = '' }: { text: string; delay?: number; className?: string }) {
  const [displayedText, setDisplayedText] = React.useState('');
  const [isComplete, setIsComplete] = React.useState(false);

  React.useEffect(() => {
    if (!text) return;
    
    setDisplayedText('');
    setIsComplete(false);
    
    const timeout = setTimeout(() => {
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsComplete(true);
          clearInterval(typingInterval);
        }
      }, 30); // Typing speed

      return () => clearInterval(typingInterval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
}

export function MediaCreationPreview({
  title,
  description,
  authors,
  thumbnailUrl,
  category,
  status,
  isVisible,
  isEditable = false,
  onTitleChange,
  onDescriptionChange,
  onStatusChange,
  onSave,
  isSaving = false,
}: MediaCreationPreviewProps) {
  const [showImage, setShowImage] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [localTitle, setLocalTitle] = React.useState(title || '');
  const [localDescription, setLocalDescription] = React.useState(description || '');
  const [localStatus, setLocalStatus] = React.useState(status || 'To-do');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);

  React.useEffect(() => {
    if (title !== undefined) setLocalTitle(title);
  }, [title]);

  React.useEffect(() => {
    if (description !== undefined) setLocalDescription(description);
  }, [description]);

  React.useEffect(() => {
    if (status !== undefined) setLocalStatus(status);
  }, [status]);

  React.useEffect(() => {
    if (isVisible && thumbnailUrl) {
      // Show image after a delay
      const timer = setTimeout(() => {
        setShowImage(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowImage(false);
      setImageLoaded(false);
    }
  }, [isVisible, thumbnailUrl]);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (onTitleChange) {
      onTitleChange(localTitle);
    }
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    if (onDescriptionChange) {
      onDescriptionChange(localDescription);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setLocalStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Card className="p-0 overflow-hidden">
        {/* Thumbnail */}
        <div className="aspect-video w-full overflow-hidden relative">
          <AnimatePresence mode="wait">
            {!showImage || !thumbnailUrl ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <Skeleton className="w-full h-full" />
              </motion.div>
            ) : (
              <motion.img
                key="image"
                src={thumbnailUrl}
                alt={title || 'Media thumbnail'}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: imageLoaded ? 1 : 0, scale: imageLoaded ? 1 : 1.1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                onLoad={() => setImageLoaded(true)}
                className="w-full h-full object-contain"
              />
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 space-y-3">
          {/* Category Badge and Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {category && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Badge variant="outline" className="text-xs">
                  {category}
                </Badge>
              </motion.div>
            )}
            {isEditable && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Select value={localStatus} onValueChange={handleStatusChange} disabled={isSaving}>
                  <SelectTrigger className="h-6 text-xs w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10002]">
                    <SelectItem value="To-do">To-do</SelectItem>
                    <SelectItem value="In progress">In progress</SelectItem>
                    <SelectItem value="Done">Done</SelectItem>
                    <SelectItem value="DNF">DNF</SelectItem>
                    <SelectItem value="Pause">Pause</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
            )}
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isEditable ? (
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onFocus={() => setIsEditingTitle(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="font-semibold text-sm leading-tight w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded px-1 -mx-1 py-1"
                disabled={isSaving}
                placeholder="Enter title..."
              />
            ) : (
              <h3 className="font-semibold text-sm leading-tight min-h-[2.5rem]">
                {title ? (
                  <TypedText text={title} delay={400} />
                ) : (
                  <Skeleton className="h-6 w-3/4" />
                )}
              </h3>
            )}
          </motion.div>

          {/* Authors */}
          {authors && authors.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-xs text-muted-foreground"
            >
              <span className="font-medium">By:</span>{' '}
              {isEditable ? (
                <span>{authors.join(', ')}</span>
              ) : (
                <TypedText text={authors.join(', ')} delay={1000} />
              )}
            </motion.div>
          )}

          {/* Description */}
          {(description || isEditable) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-xs text-muted-foreground min-h-[3rem]"
            >
              {isEditable ? (
                <textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onFocus={() => setIsEditingDescription(true)}
                  className="w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded px-1 -mx-1 py-1 resize-none min-h-[3rem]"
                  rows={3}
                  disabled={isSaving}
                  placeholder="Enter description..."
                />
              ) : description ? (
                <div className="line-clamp-3">
                  <TypedText text={description} delay={1400} />
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Save Button (only in editable mode) */}
          {isEditable && onSave && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="pt-2"
            >
              <Button
                onClick={onSave}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MiniCalendar } from '@/components/MiniCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface CreatePersonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (person: any) => void;
}

const STAR_SIGN_OPTIONS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

export function CreatePersonDialog({ isOpen, onClose, onSuccess }: CreatePersonDialogProps) {
  const [name, setName] = useState('');
  const [originOfConnection, setOriginOfConnection] = useState('');
  const [starSign, setStarSign] = useState<string>('');
  const [currentlyAt, setCurrentlyAt] = useState('');
  const [tier, setTier] = useState('');
  const [occupation, setOccupation] = useState('');
  const [contactFreq, setContactFreq] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [birthDatePopoverOpen, setBirthDatePopoverOpen] = useState(false);
  const [tierOptions, setTierOptions] = useState<string[]>([]);

  // Fetch tier options
  useEffect(() => {
    const fetchTierOptions = async () => {
      try {
        const response = await fetch('/api/people/connection');
        const data = await response.json();

        if (data.connected && data.database?.properties?.Tier?.multi_select?.options) {
          setTierOptions(
            data.database.properties.Tier.multi_select.options.map((option: any) => option.name)
          );
        } else {
          // Fallback to hardcoded order
          setTierOptions([
            'Tier Me',
            'Tier L',
            'Tier CR',
            'Tier F',
            'Tier MU',
            'Tier SA',
            'Tier A',
          ]);
        }
      } catch (error) {
        console.error('Error fetching tier options:', error);
        setTierOptions([
          'Tier Me',
          'Tier L',
          'Tier CR',
          'Tier F',
          'Tier MU',
          'Tier SA',
          'Tier A',
        ]);
      }
    };

    if (isOpen) {
      fetchTierOptions();
    }
  }, [isOpen]);

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      if (originOfConnection) formData.append('origin_of_connection', originOfConnection);
      if (starSign) formData.append('star_sign', starSign);
      if (currentlyAt) formData.append('currently_at', currentlyAt);
      if (tier) formData.append('tier', tier);
      if (occupation) formData.append('occupation', occupation);
      if (contactFreq) formData.append('contact_freq', contactFreq);
      if (fromLocation) formData.append('from_location', fromLocation);
      if (birthDate) formData.append('birth_date', birthDate.toISOString().split('T')[0]);
      if (imageFile) formData.append('image', imageFile);

      const response = await fetch('/api/people/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create person');
      }

      const data = await response.json();

      // Reset form
      setName('');
      setOriginOfConnection('');
      setStarSign('');
      setCurrentlyAt('');
      setTier('');
      setOccupation('');
      setContactFreq('');
      setFromLocation('');
      setBirthDate(undefined);
      setImageFile(null);
      setImagePreview(null);

      onSuccess(data.person);
      onClose();
    } catch (error: any) {
      console.error('Error creating person:', error);
      alert(error.message || 'Failed to create person');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setOriginOfConnection('');
      setStarSign('');
      setCurrentlyAt('');
      setTier('');
      setOccupation('');
      setContactFreq('');
      setFromLocation('');
      setBirthDate(undefined);
      setImageFile(null);
      setImagePreview(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Person</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name - Required */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter person's name"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label htmlFor="image">Profile Image</Label>
            {imagePreview ? (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="image-upload"
                  className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent"
                >
                  <Upload className="h-4 w-4" />
                  Upload Image
                </Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {/* Origin of Connection */}
          <div className="space-y-2">
            <Label htmlFor="origin_of_connection">Origin of Connection</Label>
            <Input
              id="origin_of_connection"
              value={originOfConnection}
              onChange={(e) => setOriginOfConnection(e.target.value)}
              placeholder="e.g., School, Work, Travel"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple values with commas
            </p>
          </div>

          {/* Star Sign */}
          <div className="space-y-2">
            <Label htmlFor="star_sign">Star Sign</Label>
            <Select value={starSign} onValueChange={setStarSign} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select star sign" />
              </SelectTrigger>
              <SelectContent>
                {STAR_SIGN_OPTIONS.map((sign) => (
                  <SelectItem key={sign} value={sign}>
                    {sign}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Birth Date */}
          <div className="space-y-2">
            <Label htmlFor="birth_date">Birth Date</Label>
            <Popover open={birthDatePopoverOpen} onOpenChange={setBirthDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !birthDate && 'text-muted-foreground'
                  )}
                  disabled={isSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthDate ? format(birthDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <MiniCalendar
                  mode="single"
                  selected={birthDate}
                  onSelect={(date) => {
                    setBirthDate(date);
                    setBirthDatePopoverOpen(false);
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tier */}
          {tierOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="tier">Tier</Label>
              <Select value={tier} onValueChange={setTier} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {tierOptions.map((tierOption) => (
                    <SelectItem key={tierOption} value={tierOption}>
                      {tierOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Separate multiple values with commas
              </p>
            </div>
          )}

          {/* Currently At */}
          <div className="space-y-2">
            <Label htmlFor="currently_at">Currently At</Label>
            <Input
              id="currently_at"
              value={currentlyAt}
              onChange={(e) => setCurrentlyAt(e.target.value)}
              placeholder="e.g., New York, NY"
              disabled={isSubmitting}
            />
          </div>

          {/* From Location */}
          <div className="space-y-2">
            <Label htmlFor="from_location">From</Label>
            <Input
              id="from_location"
              value={fromLocation}
              onChange={(e) => setFromLocation(e.target.value)}
              placeholder="e.g., London, UK"
              disabled={isSubmitting}
            />
          </div>

          {/* Occupation */}
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g., Software Engineer"
              disabled={isSubmitting}
            />
          </div>

          {/* Contact Frequency */}
          <div className="space-y-2">
            <Label htmlFor="contact_freq">Contact Frequency</Label>
            <Input
              id="contact_freq"
              value={contactFreq}
              onChange={(e) => setContactFreq(e.target.value)}
              placeholder="e.g., Weekly, Monthly"
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Person'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


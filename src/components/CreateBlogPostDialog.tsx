import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Upload, X, Image as ImageIcon, HelpCircle, ChevronDown, Bold, Italic, Type, Eye, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BlogContentRenderer } from '@/components/BlogContentRenderer';

interface CreateBlogPostDialogProps {
  onPostCreated: () => void;
  editPost?: {
    id: string;
    h1_title: string;
    h2_subtitle: string | null;
    slug: string;
    content: string | null;
    excerpt: string | null;
    featured_image_url: string | null;
    meta_title: string | null;
    meta_description: string | null;
    status: string;
  } | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateBlogPostDialog({ onPostCreated, editPost, open, onOpenChange }: CreateBlogPostDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [h1Title, setH1Title] = useState(editPost?.h1_title || '');
  const [h2Subtitle, setH2Subtitle] = useState(editPost?.h2_subtitle || '');
  const [slug, setSlug] = useState(editPost?.slug || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [excerpt, setExcerpt] = useState(editPost?.excerpt || '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(editPost?.featured_image_url || '');
  const [metaTitle, setMetaTitle] = useState(editPost?.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(editPost?.meta_description || '');
  const [status, setStatus] = useState(editPost?.status || 'draft');
  
  // Image upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(editPost?.featured_image_url || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Text formatting helper functions
  const wrapSelectedText = (prefix: string, suffix: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
    setContent(newText);
    
    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const insertHeading = (level: 'h2' | 'h3') => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const prefix = level === 'h2' ? '## ' : '### ';
    
    // Find the start of the current line
    const beforeCursor = content.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    
    // Check if line already has a heading prefix
    const lineContent = content.substring(lineStart);
    const existingMatch = lineContent.match(/^(#{2,3}\s)/);
    
    let newText;
    if (existingMatch) {
      // Replace existing heading
      newText = content.substring(0, lineStart) + prefix + content.substring(lineStart + existingMatch[1].length);
    } else {
      // Insert new heading prefix
      newText = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    }
    
    setContent(newText);
    
    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  const dialogOpen = open !== undefined ? open : isOpen;
  const setDialogOpen = onOpenChange || setIsOpen;

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleH1Change = (value: string) => {
    setH1Title(value);
    if (!editPost) {
      setSlug(generateSlug(value));
    }
  };

  const resetForm = () => {
    setH1Title('');
    setH2Subtitle('');
    setSlug('');
    setContent('');
    setExcerpt('');
    setFeaturedImageUrl('');
    setMetaTitle('');
    setMetaDescription('');
    setStatus('draft');
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    // Show preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setIsUploading(true);
    setUploadProgress(30);

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileExt = file.name.split('.').pop();
      const fileName = `blog/${timestamp}-${randomString}.${fileExt}`;

      setUploadProgress(50);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setUploadProgress(80);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('property-photos')
        .getPublicUrl(fileName);

      setFeaturedImageUrl(publicUrl);
      setPreviewUrl(publicUrl);
      setUploadProgress(100);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
      setPreviewUrl('');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeImage = () => {
    setFeaturedImageUrl('');
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!h1Title.trim()) {
      toast.error('H1 Title is required');
      return;
    }
    
    if (!slug.trim()) {
      toast.error('Slug is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const postData = {
        h1_title: h1Title.trim(),
        h2_subtitle: h2Subtitle.trim() || null,
        slug: slug.trim(),
        content: content.trim() || null,
        excerpt: excerpt.trim() || null,
        featured_image_url: featuredImageUrl.trim() || null,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
        status,
        published_at: status === 'published' ? new Date().toISOString() : null,
      };

      if (editPost) {
        const { error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', editPost.id);
        
        if (error) throw error;
        toast.success('Blog post updated');
      } else {
        const { error } = await supabase
          .from('blog_posts')
          .insert(postData);
        
        if (error) throw error;
        toast.success('Blog post created');
      }

      resetForm();
      setDialogOpen(false);
      onPostCreated();
    } catch (error: any) {
      console.error('Error saving blog post:', error);
      toast.error(error.message || 'Failed to save blog post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!editPost && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Blog Post
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-2xl">
            {editPost ? 'Edit Blog Post' : 'Create New Blog Post'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* SEO Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">SEO Fields</h3>
            
            <div className="space-y-2">
              <Label htmlFor="h1Title">
                H1 Heading <span className="text-destructive">*</span>
                <span className="text-muted-foreground text-xs ml-2">({h1Title.length}/60 chars)</span>
              </Label>
              <Input
                id="h1Title"
                value={h1Title}
                onChange={(e) => handleH1Change(e.target.value)}
                placeholder="Main page title (appears as H1)"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="h2Subtitle">
                H2 Subheading
                <span className="text-muted-foreground text-xs ml-2">({h2Subtitle.length}/120 chars)</span>
              </Label>
              <Input
                id="h2Subtitle"
                value={h2Subtitle}
                onChange={(e) => setH2Subtitle(e.target.value)}
                placeholder="Secondary heading (appears as H2)"
                maxLength={150}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                URL Slug <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/blog/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-friendly-slug"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">
                  Meta Title
                  <span className="text-muted-foreground text-xs ml-2">(defaults to H1)</span>
                </Label>
                <Input
                  id="metaTitle"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Custom SEO title"
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">
                  Meta Description
                  <span className="text-muted-foreground text-xs ml-2">({metaDescription.length}/160)</span>
                </Label>
                <Input
                  id="metaDescription"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="SEO description"
                  maxLength={160}
                />
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Content</h3>
            
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt (for cards & previews)</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Brief summary of the post..."
                rows={2}
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Main Content</Label>
              
              <Tabs defaultValue="write" className="w-full">
                <div className="flex items-center justify-between gap-2 mb-2">
                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 p-1 border rounded-md bg-muted/30 w-fit">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 h-8 px-2">
                          <Type className="h-4 w-4" />
                          <span className="text-xs">Heading</span>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => insertHeading('h2')}>
                          <span className="font-semibold text-lg">Heading 2</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => insertHeading('h3')}>
                          <span className="font-medium">Heading 3</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <div className="w-px h-6 bg-border mx-1" />
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 font-bold"
                      onClick={() => wrapSelectedText('**', '**')}
                      title="Bold (select text first)"
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 italic"
                      onClick={() => wrapSelectedText('*', '*')}
                      title="Italic (select text first)"
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Write/Preview Toggle */}
                  <TabsList className="h-8">
                    <TabsTrigger value="write" className="h-7 px-3 gap-1 text-xs">
                      <Edit className="h-3 w-3" />
                      Write
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="h-7 px-3 gap-1 text-xs">
                      <Eye className="h-3 w-3" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="write" className="mt-0">
                  <Textarea
                    id="content"
                    ref={contentTextareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your blog post content here..."
                    rows={10}
                  />
                </TabsContent>
                
                <TabsContent value="preview" className="mt-0">
                  <div className="min-h-[240px] max-h-[300px] overflow-y-auto p-4 border rounded-md bg-background">
                    {content ? (
                      <BlogContentRenderer content={content} className="prose prose-sm max-w-none" />
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        Start writing to see preview...
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Content Stats */}
              {content && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{content.length.toLocaleString()} characters</span>
                  <span>{content.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
                  <span>~{Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200))} min read</span>
                </div>
              )}
              
              {/* Formatting Guide */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                    Formatting Guide
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 bg-muted/50 rounded-lg text-sm space-y-3">
                    <div>
                      <p className="font-medium mb-1">Headings</p>
                      <code className="block bg-background px-2 py-1 rounded text-xs">## Section Heading</code>
                      <code className="block bg-background px-2 py-1 rounded text-xs mt-1">### Subsection Heading</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Bullet Lists</p>
                      <code className="block bg-background px-2 py-1 rounded text-xs">- First item</code>
                      <code className="block bg-background px-2 py-1 rounded text-xs mt-1">- Second item</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Numbered Lists</p>
                      <code className="block bg-background px-2 py-1 rounded text-xs">1. First step</code>
                      <code className="block bg-background px-2 py-1 rounded text-xs mt-1">2. Second step</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Bold Text</p>
                      <code className="block bg-background px-2 py-1 rounded text-xs">**bold text**</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Italic Text</p>
                      <code className="block bg-background px-2 py-1 rounded text-xs">*italic text*</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Links</p>
                      <code className="block bg-background px-2 py-1 rounded text-xs">[link text](https://example.com)</code>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Featured Image Upload */}
            <div className="space-y-2">
              <Label>Featured Image</Label>
              
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Featured image preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {isUploading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                      <div className="w-3/4">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-sm text-center mt-2">Uploading...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Click to upload featured image
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WebP (max 10MB)
                  </p>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageSelect}
                className="hidden"
              />

              {/* Or enter URL manually */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Or enter URL:</span>
                <Input
                  value={featuredImageUrl}
                  onChange={(e) => {
                    setFeaturedImageUrl(e.target.value);
                    setPreviewUrl(e.target.value);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Publishing Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Publishing</h3>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editPost ? 'Update Post' : 'Create Post'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

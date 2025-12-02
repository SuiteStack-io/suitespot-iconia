import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your blog post content here..."
                rows={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="featuredImage">Featured Image URL</Label>
              <Input
                id="featuredImage"
                value={featuredImageUrl}
                onChange={(e) => setFeaturedImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editPost ? 'Update Post' : 'Create Post'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

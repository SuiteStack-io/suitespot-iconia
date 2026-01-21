import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { SEO } from '@/components/SEO';
import { BlogContentRenderer } from '@/components/BlogContentRenderer';

interface BlogPostData {
  id: string;
  h1_title: string;
  h2_subtitle: string | null;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'published')
          .single();

        if (error || !data) {
          setNotFound(true);
        } else {
          setPost(data);
        }
      } catch (error) {
        console.error('Error fetching post:', error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNav />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNav />
        <div className="pt-32 pb-16 px-6 text-center">
          <h1 className="text-4xl font-playfair font-semibold mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-8">The blog post you're looking for doesn't exist.</p>
          <Link to="/blog" className="text-primary hover:underline">
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const pageTitle = post.meta_title || post.h1_title;
  const pageDescription = post.meta_description || post.excerpt || '';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${pageTitle} | SuiteSpot Blog`}
        description={pageDescription}
        path={`/blog/${post.slug}`}
        ogImage={post.featured_image_url || undefined}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.h1_title }
        ]}
      />

      <PublicNav />

      {/* Featured Image */}
      {post.featured_image_url && (
        <div className="w-full h-[40vh] md:h-[50vh] relative">
          <img
            src={post.featured_image_url}
            alt={post.h1_title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}

      {/* Content */}
      <article className={`container mx-auto max-w-3xl px-6 ${post.featured_image_url ? '-mt-24 relative z-10' : 'pt-32'}`}>
        <Link 
          to="/blog" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Blog
        </Link>

        <header className="mb-12">
          <h1 className="font-playfair font-semibold text-[40px] md:text-[60px] leading-tight tracking-[-0.02em] text-foreground mb-4">
            {post.h1_title}
          </h1>
          
          {post.h2_subtitle && (
            <h2 className="font-playfair font-medium text-[24px] md:text-[32px] text-muted-foreground mb-6">
              {post.h2_subtitle}
            </h2>
          )}

          {post.published_at && (
            <p className="text-sm text-muted-foreground">
              Published on {format(new Date(post.published_at), 'MMMM d, yyyy')}
            </p>
          )}
        </header>

        {post.content && (
          <BlogContentRenderer 
            content={post.content} 
            className="prose prose-lg max-w-none font-playfair text-[16px] leading-[1.8] text-foreground" 
          />
        )}
      </article>

      {/* Footer */}
      <footer className="py-12 px-6 bg-card border-t border-border mt-24">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-serif font-bold text-foreground mb-4">SuiteSpot</h3>
              <p className="text-sm text-muted-foreground">
                Redefining serviced apartment living in Egypt
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Explore</h4>
              <div className="space-y-2">
                <Link to="/iconia-zamalek" className="block text-sm text-muted-foreground hover:text-foreground">ICONIA Zamalek</Link>
                <Link to="/locations" className="block text-sm text-muted-foreground hover:text-foreground">Locations</Link>
                <Link to="/suites" className="block text-sm text-muted-foreground hover:text-foreground">Suites</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Experience</h4>
              <div className="space-y-2">
                <Link to="/wellness" className="block text-sm text-muted-foreground hover:text-foreground">Wellness</Link>
                <Link to="/experiences" className="block text-sm text-muted-foreground hover:text-foreground">Experiences</Link>
                <Link to="/nearby" className="block text-sm text-muted-foreground hover:text-foreground">Nearby</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Contact</h4>
              <p className="text-sm text-muted-foreground">
                Iconia, Zamalek<br />
                Cairo, Egypt
              </p>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; 2025 SuiteSpot Hospitality. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogPost;

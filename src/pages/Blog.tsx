import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';

interface BlogPost {
  id: string;
  h1_title: string;
  h2_subtitle: string | null;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
}

const Blog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, h1_title, h2_subtitle, slug, excerpt, featured_image_url, published_at')
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Blog | SuiteSpot - Stories & Insights from Serviced Living</title>
        <meta name="description" content="Stories, insights, and inspiration from our serviced living community in Egypt. Discover travel tips, local guides, and hospitality excellence." />
        <link rel="canonical" href="https://suitespoteg.com/blog" />
      </Helmet>

      <PublicNav />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="font-playfair font-semibold text-[40px] md:text-[60px] tracking-[-0.02em] text-foreground mb-6">
            SuiteSpot Blog
          </h1>
          <p className="font-playfair font-normal text-[18px] md:text-[20px] text-muted-foreground">
            Stories, insights, and inspiration from our serviced living community
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-6xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground font-playfair text-[16px]">Blog posts coming soon...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link 
                  key={post.id} 
                  to={`/blog/${post.slug}`}
                  className="group"
                >
                  <article className="bg-card rounded-lg overflow-hidden border border-border hover:shadow-lg transition-shadow">
                    {post.featured_image_url ? (
                      <div className="aspect-[16/10] overflow-hidden">
                        <img
                          src={post.featured_image_url}
                          alt={post.h1_title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/10] bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">No image</span>
                      </div>
                    )}
                    <div className="p-6">
                      <h2 className="font-playfair font-semibold text-[20px] md:text-[24px] tracking-[-0.01em] text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {post.h1_title}
                      </h2>
                      {post.h2_subtitle && (
                        <p className="font-playfair font-normal text-[14px] text-muted-foreground mb-3 line-clamp-1">
                          {post.h2_subtitle}
                        </p>
                      )}
                      {post.excerpt && (
                        <p className="font-playfair font-normal text-[14px] text-muted-foreground mb-4 line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                      {post.published_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.published_at), 'MMMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

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
                <Link to="/our-story" className="block text-sm text-muted-foreground hover:text-foreground">Our Story</Link>
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

export default Blog;

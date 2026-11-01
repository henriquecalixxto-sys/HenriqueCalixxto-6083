import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "../../components/layout";
import { Reveal } from "../../components/reveal";
import { api } from "../../lib/api";

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = useQuery({
    queryKey: ["blog", slug],
    queryFn: async () => (await api.blog[":slug"].$get({ param: { slug } })).json(),
  });

  if (post.isLoading) {
    return <Layout><div className="min-h-[60vh] flex items-center justify-center text-brand-gray">Loading...</div></Layout>;
  }
  if (!post.data || "message" in post.data) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-brand-gray">Article not found.</p>
          <Link to="/blog" className="text-brand-gold underline">Back to Blog</Link>
        </div>
      </Layout>
    );
  }

  const p = post.data.post;

  return (
    <Layout>
      <section className="pt-40 pb-20 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">{p.category}</p>
          <h1 className="text-3xl md:text-5xl max-w-3xl mx-auto">{p.title}</h1>
        </Reveal>
      </section>

      <section className="py-20 max-w-[720px] mx-auto px-6">
        <Reveal>
          <p className="text-brand-gray leading-loose whitespace-pre-line">{p.content}</p>
        </Reveal>
        <Reveal className="mt-16 pt-8 border-t border-brand-border">
          <Link to="/blog" className="text-brand-gold text-xs uppercase tracking-wide">← Back to All Articles</Link>
        </Reveal>
      </section>
    </Layout>
  );
}

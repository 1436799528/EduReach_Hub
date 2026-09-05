import { useMemo } from 'react';
import { blogPosts } from '../src/data/edulebMock';
import { blogArticles } from '../src/data/blogArticles';
import { Shell } from '../src/components/EdulebShared';

export default function BlogDetailsPage({ id }: { id: string }) {
  const post = blogPosts.find((item) => item.id === id) ?? blogPosts[0];
  const article = blogArticles[post.id];
  const relatedPosts = useMemo(() => blogPosts.filter((item) => item.id !== post.id && item.category === post.category).slice(0, 3), [post.id, post.category]);

  return (
    <Shell title="News Details">
      <section className="blog_details_area section-padding">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <article className="blog-detail-card">
                <div className="blog-detail-image"><img src={post.image} alt={post.title} /></div>
                <div className="blog-detail-content">
                  <div className="blog_meta"><span>{post.date}</span><span>{post.category}</span>{post.badge && <span>{post.badge}</span>}</div>
                  <h1>{post.title}</h1>
                  <div className="blog-detail-byline"><span>{post.author}</span><span>{post.readTime}</span></div>
                  <p className="blog-detail-lead">{post.excerpt}</p>
                  {article?.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  <div className="blog-detail-source"><strong>Source:</strong> {article?.source ?? 'EduReach Mock News Desk'} &nbsp; <strong>Updated:</strong> {article?.updatedAt ?? post.date}</div>
                  <a href="/blog" className="btn_one">Back To News</a>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      {relatedPosts.length > 0 && (
        <section className="blog_area section-padding related-blog-area">
          <div className="container">
            <div className="section-title text-center"><h2>Related Updates</h2><p>More stories from the same EduReach category.</p></div>
            <div className="row">
              {relatedPosts.map((item) => (
                <div className="col-lg-4 col-sm-6" key={item.id}>
                  <article className="blog_post"><a href={`/blog/${item.id}`} className="blog-img"><img src={item.image} alt={item.title} loading="lazy" /></a><div className="blog_content"><div className="blog_meta"><span>{item.date}</span><span>{item.category}</span></div><h3><a href={`/blog/${item.id}`}>{item.title}</a></h3><p>{item.excerpt}</p><a href={`/blog/${item.id}`} className="blog_readmore">Read More <i className="fa fa-long-arrow-right" /></a></div></article>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </Shell>
  );
}

import { useMemo, useState } from 'react';
import { blogPosts } from '../src/data/edulebMock';
import { Shell } from '../src/components/EdulebShared';

const categories = ['All', 'News', 'Campus Gist', 'JAMB', 'WAEC', 'NECO', 'Admissions', 'Funding', 'Academic Update', 'Student Guide', 'Opportunities', 'Results'];

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const filteredPosts = useMemo(() => blogPosts.filter((post) => (activeCategory === 'All' || post.category === activeCategory) && `${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(query.trim().toLowerCase())), [activeCategory, query]);

  return (
    <Shell title="News &amp; Updates">
      <section className="blog_area section-padding"><div className="container">
        <div className="section-title text-center"><h2>EduReach News &amp; Campus Gist</h2><p>News, updates, quick notices, campus conversations, admissions, examinations, funding and student opportunities.</p></div>
        <div className="blog-filter-bar"><input className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search news and updates" aria-label="Search news and updates" /> <div className="blog-filter-chips">{categories.map((category) => <button type="button" className={activeCategory === category ? 'active' : ''} key={category} onClick={() => setActiveCategory(category)}>{category}</button>)}</div></div>
        <div className="row">{filteredPosts.map((post) => <div className="col-lg-4 col-sm-6 col-xs-12" key={post.id}><article className="blog_post"><a href={`/blog/${post.id}`} className="blog-img"><img src={post.image} alt={post.title} loading="lazy" /></a><div className="blog_content"><div className="blog_meta"><span>{post.date}</span><span>{post.category}</span>{post.badge && <span>{post.badge}</span>}</div><h3><a href={`/blog/${post.id}`}>{post.title}</a></h3><p>{post.excerpt}</p><div className="blog-card-footer"><span>{post.author}</span><span>{post.readTime}</span></div><a href={`/blog/${post.id}`} className="blog_readmore">Read More <i className="fa fa-long-arrow-right" /></a></div></article></div>)}</div>
        {!filteredPosts.length && <div className="empty-state">No mock updates match your search.</div>}
      </div></section>
    </Shell>
  );
}

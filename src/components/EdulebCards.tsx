import type { Course, Instructor, BlogPost } from '../data/edulebMock';
import { courses, instructors, blogPosts, categories } from '../data/edulebMock';
import { imageBase, fallbackImage } from './EdulebShared';

const instructorImages = ['team1.jpg', 'team2.jpg', 'team3.jpg', 'team4.jpg'];

export function CourseCard({ course }: { course: Course }) {
  return (
    <div className="col-lg-4 col-sm-6 col-xs-12">
      <div className="course-slide">
        <div className="course-img">
          <img
            src={course.image}
            alt={course.title}
            onError={(e) => {
              e.currentTarget.src = fallbackImage;
            }}
          />
          <span>{course.category}</span>
        </div>
        <div className="course_content">
          <span className="course_meta">{course.level} · {course.rating}/5</span>
          <h3><a href={`/course_details.html?course=${course.id}`}>{course.title}</a></h3>
          <p>{course.description}</p>
          <div className="course-meta">
            <span><i className="fa-regular fa-circle-play" /> {course.lessons} lessons</span>
            <span><i className="fa-regular fa-clock" /> {course.duration}</span>
          </div>
          <div className="course_bottom">
            <strong>{course.price}</strong>
            <a className="course_btn" href={`/course_details.html?course=${course.id}`}>View course</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstructorCard({ instructor }: { instructor: Instructor }) {
  const index = Math.max(0, instructors.findIndex((item) => item.id === instructor.id));
  const image = `${imageBase}/team/${instructorImages[index % instructorImages.length]}`;

  return (
    <div className="col-lg-3 col-sm-6 col-xs-12">
      <div className="single_team">
        <div className="team_img">
          <a href={`/instructor_details.html?instructor=${instructor.id}`}>
            <img
              src={image}
              alt={instructor.name}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', `<div class="demo-avatar">${instructor.initials}</div>`);
              }}
            />
          </a>
        </div>
        <h4><a href={`/instructor_details.html?instructor=${instructor.id}`}>{instructor.name}</a></h4>
        <p>{instructor.role}</p>
        <div className="team_info">
          <span>{instructor.courses.toString().padStart(2, '0')} Course</span>
          <span>{instructor.students.toLocaleString()} Student</span>
        </div>
      </div>
    </div>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <div className="col-lg-4 col-sm-6 col-xs-12">
      <article className="blog_post">
        <div className="blog-img">
          <img
            src={post.image}
            alt={post.title}
            onError={(e) => {
              e.currentTarget.src = fallbackImage;
            }}
          />
        </div>
        <div className="blog_content">
          <div className="blog_meta">
            <span>{post.date}</span>
            <a href={`/blog_details.html?post=${post.id}`}>{post.category}</a>
          </div>
          <h3><a href={`/blog_details.html?post=${post.id}`}>{post.title}</a></h3>
          <p>{post.excerpt}</p>
          <a className="blog_readmore" href={`/blog_details.html?post=${post.id}`}>Read More <i className="fa fa-long-arrow-right" /></a>
        </div>
      </article>
    </div>
  );
}

export function StatsStrip() {
  const stats = [
    ['134', 'Our Online Course', 'folder'],
    ['29', 'Academic Programs', 'medall-alt'],
    ['684', 'Certified Students', 'id-badge'],
    ['9,410', 'Enrolled Students', 'user'],
  ];

  return (
    <section className="count_area counter_feature">
      <div className="container">
        <div className="row">
          {stats.map(([value, label, icon]) => (
            <div className="col-lg-3 col-sm-6 col-xs-12" key={label}>
              <div className="single-counter">
                <span className={`ti-${icon} sc_one`} />
                <h2 className="counter-num">{value}</h2>
                <p>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function JourneySection() {
  const cards = [
    ['01', 'Expert Teacher', 'Learn from instructors who understand both theory and practical work.'],
    ['02', 'Quality Education', 'Short, structured lessons make it easier to learn consistently.'],
    ['03', 'Remote Learning', 'Study from anywhere with a responsive course experience.'],
    ['04', 'Life Time Support', 'Keep your learning resources close as your skills grow.'],
  ];

  return (
    <section className="top_cat__area section-padding">
      <div className="container">
        <div className="section-title text-center">
          <h2>Start your journey With us</h2>
          <p>Choose from practical learning options and build new skills step by step.</p>
        </div>
        <div className="row">
          {cards.map(([n, t, d]) => (
            <div className="col-lg-3 col-sm-6 col-xs-12" key={n}>
              <div className="single_tp">
                <span className="sc_one">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { courses, instructors, blogPosts, categories, imageBase };

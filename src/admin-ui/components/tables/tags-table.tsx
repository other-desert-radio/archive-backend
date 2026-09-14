import type { TagsAdminRow } from "../../loaders/tags.js";

export const TagsTable = ({ tags }: { tags: TagsAdminRow[] }) => (
  <div className="table-wrapper">
    <table>
      <caption className="visually-hidden">Tags</caption>
      <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col">Title</th>
          <th scope="col">Color</th>
        </tr>
      </thead>
      <tbody>
        {tags.map(tag => (
          <tr key={tag.id}>
            <td>{tag.id}</td>
            <td>{tag.title}</td>
            <td>{tag.color}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

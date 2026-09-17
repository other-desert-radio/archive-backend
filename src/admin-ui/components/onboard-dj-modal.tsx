import { logger } from "better-auth";
import { useState } from "react";
import { validateTags } from "../loaders/validate-tags.js";

type OnboardDJModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FormControlProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  textarea?: boolean;
};

/**
 * Renders a reusable labeled input or textarea form control.
 *
 * @param props - The field label, value, change handler, and optional blur
 * handler.
 */
export const FormInput = ({
  name,
  label,
  value,
  onChange,
  onBlur,
  textarea = false,
}: FormControlProps) => {
  const id = `onboard-dj-${name}-input`;
  return (
    <div className="modal-field">
      <label htmlFor={id}>{label}</label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      ) : (
        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
    </div>
  );
};

/**
 * Provides the reusable overlay and panel shell for DJ onboarding.
 *
 * @param props - The modal visibility and close callback.
 */
export const OnboardDJModal = ({ isOpen, onClose }: OnboardDJModalProps) => {
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [tags, setTags] = useState("");
  const [socials, setSocials] = useState("");
  const [bio, setBio] = useState("");
  const [validationError, setValidationError] = useState<string>();
  const [missingTags, setMissingTags] = useState<string[]>([]);

  /** Clears missing-tag feedback whenever the tags field is edited. */
  const handleTagsChange = (value: string) => {
    setTags(value);
    setMissingTags([]);
  };

  /** Validates comma-separated tags after the field loses focus. */
  const handleTagsBlur = async () => {
    const submittedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");

    if (submittedTags.length === 0) {
      setMissingTags([]);
      return;
    }

    try {
      const result = await validateTags(submittedTags);
      setMissingTags(result.invalid);
    } catch (e) {
      logger.error("error validating tags", e);
      setMissingTags([]);
    }
  };

  /** Validates the required fields without submitting persistence yet. */
  const handleSubmit = () => {
    if (title.trim() === "" || bio.trim() === "") {
      setValidationError("Title and bio are required.");
      return;
    }
    // TODO: Use CreateDJRequest from ../../admin/routes/djs/index.js for the submit payload. via isMatching function

    setValidationError(undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-dj-title"
      >
        <div className="modal-header">
          <h2 id="onboard-dj-title">Onboard DJ</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>
        <div className="modal-form">
          <FormInput
            name="title"
            label="title"
            value={title}
            onChange={setTitle}
          />
          <FormInput
            name="image"
            label="image"
            value={image}
            onChange={setImage}
          />
          <FormInput
            name="tags"
            label="tags"
            value={tags}
            onChange={handleTagsChange}
            onBlur={handleTagsBlur}
          />
          {missingTags.length > 0 && (
            <p className="modal-helper">
              These tags will be created after submit: {missingTags.join(", ")}.
            </p>
          )}
          <FormInput
            name="socials"
            label="socials"
            value={socials}
            onChange={setSocials}
            textarea
          />
          <FormInput
            name="bio"
            label="bio"
            value={bio}
            onChange={setBio}
            textarea
          />
        </div>
        {validationError !== undefined && (
          <p className="modal-error" role="alert">
            {validationError}
          </p>
        )}
        <button type="button" className="submit-button" onClick={handleSubmit}>
          Submit
        </button>
      </div>
    </div>
  );
};

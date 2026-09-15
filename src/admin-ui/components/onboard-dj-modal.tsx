import { useState } from "react";

type OnboardDJModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

/** Provides the reusable overlay and panel shell for DJ onboarding. */
export const OnboardDJModal = ({ isOpen, onClose }: OnboardDJModalProps) => {
	const [title, setTitle] = useState("");
	const [image, setImage] = useState("");

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
					<div className="modal-field">
						<label htmlFor="onboard-dj-title-input">title</label>
						<input
							id="onboard-dj-title-input"
							name="title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
						/>
					</div>
					<div className="modal-field">
						<label htmlFor="onboard-dj-image-input">image</label>
						<input
							id="onboard-dj-image-input"
							name="image"
							value={image}
							onChange={(event) => setImage(event.target.value)}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

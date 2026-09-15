type OnboardDJModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

/** Provides the reusable overlay and panel shell for DJ onboarding. */
export const OnboardDJModal = ({ isOpen, onClose }: OnboardDJModalProps) => {
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
			</div>
		</div>
	);
};

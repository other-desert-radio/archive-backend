import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ImportShowModal } from "../../src/admin-ui/components/mixcloud/index.js";
import { importRows } from "./import-show-data.js";
import "../../src/admin-ui/styles.css";

const Fixture = () => {
	const [open, setOpen] = useState(false);
	const [index, setIndex] = useState(0);
	const [saved, setSaved] = useState("");
	const row = importRows[index];
	return (
		<>
			<button
				type="button"
				onClick={() => {
					setIndex(0);
					setOpen(true);
				}}
			>
				Open import
			</button>
			<button type="button" onClick={() => setIndex(1)}>
				Replace source
			</button>
			<output aria-label="Imported Show">{saved}</output>
			{open && row && (
				<ImportShowModal
					row={row}
					remainingCount={2}
					onClose={() => setOpen(false)}
					onSkip={() => setIndex(1)}
					onImported={(show) => {
						setSaved(show.title);
						setOpen(false);
					}}
				/>
			)}
		</>
	);
};
const root = document.getElementById("root");
if (root) createRoot(root).render(<Fixture />);

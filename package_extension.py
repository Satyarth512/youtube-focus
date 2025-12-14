
import zipfile
import os

# Files to include in the release package
files_to_package = [
    "manifest.json",
    "background.js",
    "content.js",
    "styles.css",
    "options.html",
    "options.js"
]

folder_to_package = "icons"
output_filename = "youtube-focus-v1.0.zip"

def create_zip():
    try:
        with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add root files
            for file in files_to_package:
                if os.path.exists(file):
                    zipf.write(file)
                    print(f"Added: {file}")
                else:
                    print(f"Warning: Missing file {file}")

            # Add icons folder
            for root, dirs, files in os.walk(folder_to_package):
                for file in files:
                    file_path = os.path.join(root, file)
                    zipf.write(file_path)
                    print(f"Added: {file_path}")

        print(f"\nSUCCESS! Extension packaged into: {output_filename}")
    except Exception as e:
        print(f"Error creating zip: {e}")

if __name__ == "__main__":
    create_zip()

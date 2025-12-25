import os
import zipfile

def zip_dist_folder():
    source_dir = 'dist'
    zip_filename = 'dist.zip'
    
    # Remove existing zip if it exists
    if os.path.exists(zip_filename):
        os.remove(zip_filename)
        print(f"Removed old {zip_filename}")

    if not os.path.exists(source_dir):
        print(f"Error: '{source_dir}' directory not found!")
        return

    print(f"Zipping contents of '{source_dir}' to '{zip_filename}'...")
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Walk through the directory
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                # Create the full path to the file
                file_path = os.path.join(root, file)
                
                # Calculate the relative path (path inside the zip)
                # This removes 'dist/' from the start of the path
                arcname = os.path.relpath(file_path, start=source_dir)
                
                print(f"  Adding: {arcname}")
                zipf.write(file_path, arcname)
                
    print(f"✅ Success! Created {zip_filename} with flat structure.")
    print("This zip file is ready for Capacitor Updater.")

if __name__ == "__main__":
    zip_dist_folder()

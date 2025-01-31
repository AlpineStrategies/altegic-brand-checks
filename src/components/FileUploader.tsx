import React from 'react';



interface FileUploaderProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  label?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  accept = '.pdf',
  label = 'Upload File'
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    console.log('File selected in FileUploader:', file?.name);
    onFileSelect(file);
  };

  return (
    <div>
      <label>
        {label}
        <input
          type="file"
          onChange={handleChange}
          accept={accept}
          style={{ marginLeft: '1rem' }}
        />
      </label>
    </div>
  );
};
export interface ResourceType {
  id: string;
  name: string;
  icon: React.ReactNode;
  bgColor: string;
  isActive: boolean;
  fileType?: 'blackboard' | 'youtube' | 'video' | 'zip' | 'image' | 'audio';
  type: 'url' | 'github' | 'local' | 'link' | 'webcrawler';
  accept?: string;
}

export const resourceTypes: ResourceType[] = [
  {
    id: 'powerpoint',
    name: 'PowerPoint',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.6 0H14.14V2.45C15.51 2.46 16.89 2.42 18.27 2.46C18.9 2.4 19.38 2.89 19.32 3.51C19.37 8.59 19.31 13.68 19.35 18.76C19.32 19.31 19.4 19.92 19.09 20.41C18.69 20.7 18.18 20.66 17.71 20.68C16 20.67 14.28 20.67 12.57 20.67V23.4H10.88C6.73 22.64 2.58 21.95 -1.57 21.22V2.17C3.63 1.46 8.11 0.71 12.6 0Z"
          fill="#d24625"
        />
        <path
          d="M14.14 3.27H23.12V19.89H14.14V17.71H20.66V16.62H14.14V15.25H20.66V14.16H14.14C14.14 13.63 14.14 13.09 14.14 12.56C15.22 12.89 16.44 12.89 17.41 12.24C18.45 11.62 19.0 10.44 19.09 9.27C17.9 9.26 16.71 9.27 15.51 9.27C15.51 8.09 15.53 6.9 15.49 5.72C15.05 5.81 14.6 5.9 14.14 6.0V3.27Z"
          fill="#ffffff"
        />
        <path
          d="M16.06 5.14C17.95 5.23 19.54 6.82 19.64 8.71C18.45 8.72 17.25 8.72 16.06 8.72C16.06 7.53 16.06 6.33 16.06 5.14Z"
          fill="#d24625"
        />
        <path
          d="M4.37 7.19C5.85 7.26 7.64 6.6 8.86 7.71C9.83 9.13 9.72 11.75 8.0 12.6C7.38 12.92 6.67 12.87 5.99 12.85C5.99 13.91 5.99 14.98 5.99 16.04C5.37 15.91 4.75 15.9 4.13 15.9C4.11 12.99 4.1 10.09 4.37 7.19Z"
          fill="#ffffff"
        />
        <path
          d="M5.99 8.67C6.52 8.64 7.19 8.55 7.55 9.05C7.86 9.58 7.84 10.29 7.59 10.84C7.28 11.4 6.58 11.35 6.03 11.41C5.97 10.5 5.98 9.58 5.99 8.67Z"
          fill="#d24625"
        />
      </svg>
    ),
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'link',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M19.5 15.5C21.433 15.5 23 13.933 23 12C23 10.067 21.433 8.5 19.5 8.5C19.11 8.5 18.735 8.56 18.385 8.67C17.755 6.535 15.785 5 13.5 5C10.74 5 8.5 7.24 8.5 10C8.5 10.15 8.51 10.3 8.525 10.445C8.185 10.33 7.82 10.265 7.44 10.265C5.525 10.265 4 11.79 4 13.705C4 15.62 5.525 17.145 7.44 17.145H19.5V15.5Z"
          fill="#0078D4"
        />
      </svg>
    ),
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'link',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.0014 9.33803L9.40575 4.75723C9.49193 4.66949 9.58608 4.61193 9.68023 4.57324C8.92485 4.82516 8.57363 5.68471 8.57363 5.68471L3.83171 14.0509C3.76499 14.3132 3.74646 14.55 3.7548 14.7586H8.93039L12.0014 9.33803Z"
          fill="#34A853"
        />
        <path
          d="M12.0015 9.33803L15.0725 14.7586H20.2481C20.2565 14.55 20.2379 14.3132 20.1712 14.0509L14.4293 5.68471C14.4293 5.68471 14.0772 4.82516 13.3226 4.57324C13.4159 4.61193 13.5109 4.66949 13.5971 4.75723L12.0015 9.33803Z"
          fill="#FBBC05"
        />
        <path
          d="M12.0014 9.33855L13.5971 4.75778C13.5109 4.67004 13.4158 4.61248 13.3226 4.57379C13.2095 4.537 13.0932 4.51246 12.9616 4.50586H12.8344H10.1935H10.0663C9.93565 4.51152 9.81833 4.53605 9.69025 4.57379C9.59701 4.61248 9.50195 4.67004 9.41577 4.75778L12.0014 9.33855Z"
          fill="#188038"
        />
        <path
          d="M8.93115 14.7587L6.36515 19.2876C6.36515 19.2876 6.27988 19.2461 6.16406 19.1602C6.52826 19.4404 6.88225 19.4999 6.88225 19.4999H16.9601C17.5161 19.4999 17.6319 19.2876 17.6319 19.2876C17.6337 19.2866 17.6347 19.2857 17.6365 19.2848L15.0724 14.7587H8.93115Z"
          fill="#4285F4"
        />
        <path
          d="M8.93145 14.7587H3.75586C3.78181 15.3739 4.0487 15.7334 4.0487 15.7334L4.24329 16.0711C4.2572 16.091 4.26554 16.1023 4.26554 16.1023L4.68904 16.8458L5.63982 18.5007C5.66762 18.5677 5.70006 18.629 5.73435 18.6875C5.74732 18.7073 5.75936 18.729 5.77327 18.7479C5.77697 18.7536 5.78068 18.7592 5.78439 18.7649C5.90208 18.9309 6.03367 19.0592 6.16526 19.1602C6.28108 19.247 6.36635 19.2876 6.36635 19.2876L8.93145 14.7587Z"
          fill="#1967D2"
        />
        <path
          d="M15.0725 14.7587H20.2481C20.2221 15.3739 19.9552 15.7334 19.9552 15.7334L19.7606 16.0711C19.7467 16.091 19.7384 16.1023 19.7384 16.1023L19.3149 16.8458L18.3641 18.5007C18.3363 18.5677 18.3039 18.629 18.2696 18.6875C18.2566 18.7073 18.2446 18.729 18.2307 18.7479C18.227 18.7536 18.2233 18.7592 18.2195 18.7649C18.1018 18.9309 17.9703 19.0592 17.8387 19.1602C17.7229 19.247 17.6376 19.2876 17.6376 19.2876L15.0725 14.7587Z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'link',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6 6.75L12 2.25L18 6.75L12 11.25L6 6.75Z" fill="#0061FF" />
        <path d="M18 6.75L12 11.25L18 15.75L24 11.25L18 6.75Z" fill="#0061FF" />
        <path d="M0 11.25L6 6.75L12 11.25L6 15.75L0 11.25Z" fill="#0061FF" />
        <path
          d="M12 21.75L6 17.25L12 12.75L18 17.25L12 21.75Z"
          fill="#0061FF"
        />
      </svg>
    ),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'url',
    fileType: 'youtube',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22.54 6.42C22.4212 5.94541 22.1793 5.51057 21.8387 5.15941C21.498 4.80824 21.0708 4.55318 20.6 4.42C18.88 4 12 4 12 4C12 4 5.12 4 3.4 4.46C2.92925 4.59318 2.50198 4.84824 2.16135 5.19941C1.82072 5.55057 1.57879 5.98541 1.46 6.46C1.14521 8.20556 0.991235 9.97631 1 11.75C0.988687 13.537 1.14266 15.3213 1.46 17.08C1.57879 17.5546 1.82072 17.9894 2.16135 18.3406C2.50198 18.6918 2.92925 18.9468 3.4 19.08C5.12 19.54 12 19.54 12 19.54C12 19.54 18.88 19.54 20.6 19.08C21.0708 18.9468 21.498 18.6918 21.8387 18.3406C22.1793 17.9894 22.4212 17.5546 22.54 17.08C22.8524 15.3427 23.0063 13.5733 23 11.8C23.0113 10.013 22.8573 8.22866 22.54 6.47V6.42Z"
          fill="#FF0000"
        />
        <path d="M9.75 15.02L15.5 11.75L9.75 8.48V15.02Z" fill="white" />
      </svg>
    ),
  },
  {
    id: 'url',
    name: 'URL',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'url',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3.9 12C3.9 10.29 5.29 8.9 7 8.9H11V7H7C4.24 7 2 9.24 2 12C2 14.76 4.24 17 7 17H11V15.1H7C5.29 15.1 3.9 13.71 3.9 12ZM8 13H16V11H8V13ZM17 7H13V8.9H17C18.71 8.9 20.1 10.29 20.1 12C20.1 13.71 18.71 15.1 17 15.1H13V17H17C19.76 17 22 14.76 22 12C22 9.24 19.76 7 17 7Z"
          fill="#8B5CF6"
        />
      </svg>
    ),
  },
  {
    id: 'pdf',
    name: 'PDF',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept: 'application/pdf',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
          fill="#E53935"
        />
        <path d="M4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6Z" fill="#E53935" />
        <path d="M9.5 10.5H11V6.5H13V10.5H14.5L12 13L9.5 10.5Z" fill="white" />
      </svg>
    ),
  },
  {
    id: 'docx',
    name: 'DOCX',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="2" y="2" width="20" height="20" rx="2" fill="#2B579A" />
        <path d="M7 7H17V8.5H7V7Z" fill="white" />
        <path d="M7 10H17V11.5H7V10Z" fill="white" />
        <path d="M7 13H17V14.5H7V13Z" fill="white" />
        <path d="M7 16H13V17.5H7V16Z" fill="white" />
      </svg>
    ),
  },
  {
    id: 'excel',
    name: 'Excel',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="2" y="2" width="20" height="20" rx="2" fill="#217346" />
        <path d="M7 7H17V9H7V7Z" fill="white" />
        <path d="M7 10H17V12H7V10Z" fill="white" />
        <path d="M7 13H17V15H7V13Z" fill="white" />
        <path d="M7 16H17V18H7V16Z" fill="white" />
        <path d="M11 7V18H13V7H11Z" fill="white" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: 'csv',
    name: 'CSV',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept: 'text/csv,.csv',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="2" y="2" width="20" height="20" rx="2" fill="#217346" />
        <path d="M7 7H11V9H7V7Z" fill="white" />
        <path d="M13 7H17V9H13V7Z" fill="white" />
        <path d="M7 10H11V12H7V10Z" fill="white" />
        <path d="M13 10H17V12H13V10Z" fill="white" />
        <path d="M7 13H11V15H7V13Z" fill="white" />
        <path d="M13 13H17V15H13V13Z" fill="white" />
        <path d="M7 16H11V18H7V16Z" fill="white" />
        <path d="M13 16H17V18H13V16Z" fill="white" />
      </svg>
    ),
  },
  {
    id: 'github',
    name: 'GitHub',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'github',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.477 2 12C2 16.418 4.865 20.166 8.839 21.489C9.339 21.581 9.521 21.278 9.521 21.017C9.521 20.783 9.512 20.036 9.508 19.205C6.726 19.758 6.139 17.782 6.139 17.782C5.685 16.643 5.028 16.341 5.028 16.341C4.132 15.729 5.097 15.741 5.097 15.741C6.094 15.812 6.628 16.761 6.628 16.761C7.521 18.257 8.97 17.829 9.539 17.577C9.631 16.969 9.889 16.542 10.175 16.299C7.955 16.054 5.62 15.233 5.62 11.477C5.62 10.387 6.01 9.492 6.649 8.787C6.546 8.54 6.203 7.559 6.747 6.174C6.747 6.174 7.587 5.909 9.497 7.211C10.3 6.992 11.15 6.883 12 6.879C12.85 6.883 13.7 6.992 14.503 7.211C16.413 5.909 17.253 6.174 17.253 6.174C17.797 7.559 17.454 8.54 17.351 8.787C17.99 9.492 18.38 10.387 18.38 11.477C18.38 15.243 16.042 16.051 13.813 16.291C14.172 16.592 14.492 17.188 14.492 18.095C14.492 19.382 14.48 20.692 14.48 21.017C14.48 21.281 14.659 21.587 15.167 21.487C19.138 20.161 22 16.416 22 12C22 6.477 17.523 2 12 2Z"
          fill="black"
        />
      </svg>
    ),
  },
  {
    id: 'text',
    name: 'TXT',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept: 'text/plain',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="24" height="24" rx="4" fill="url(#paint0_linear_text)" />
        <path d="M7 7H17V9H13V17H11V9H7V7Z" fill="white" />
        <defs>
          <linearGradient
            id="paint0_linear_text"
            x1="0"
            y1="0"
            x2="24"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#4F46E5" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: 'audio',
    name: 'Audio',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept: 'audio/*',
    fileType: 'audio',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z"
          fill="#4CAF50"
        />
      </svg>
    ),
  },
  {
    id: 'video',
    name: 'Video',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept: 'video/*',
    fileType: 'video',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
          fill="#2196F3"
        />
        <path d="M9.5 16V8L16.5 12L9.5 16Z" fill="white" />
      </svg>
    ),
  },
  {
    id: 'image',
    name: 'Image',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'local',
    accept: 'image/*',
    fileType: 'image',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="24" height="24" rx="4" fill="#4285F4" />
        <circle cx="8.5" cy="8.5" r="2.5" fill="#FFFFFF" />
        <path d="M5 19L8.5 14L12 19H5Z" fill="#FFFFFF" />
        <path d="M12 19L15.5 14L19 19H12Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'web-crawler',
    name: 'Web Crawler',
    bgColor: 'bg-blue-100',
    isActive: true,
    type: 'webcrawler',
    accept: 'url',
    icon: (
      <img src="/la-toile.png" alt="Website Crawler" width={24} height={24} />
    ),
  },
  {
    id: 'zip',
    name: 'ZIP',
    bgColor: 'bg-blue-100',
    isActive: false,
    type: 'local',
    fileType: 'zip',
    accept: 'application/zip',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
          fill="#E53935"
        />
        <path d="M14 2V8H20L14 2Z" fill="#FF8A80" />
        <path d="M10 14H12V16H10V14Z" fill="white" />
        <path d="M10 10H12V12H10V10Z" fill="white" />
        <path d="M10 6H12V8H10V6Z" fill="white" />
        <path d="M10 18H12V20H10V18Z" fill="white" />
      </svg>
    ),
  },
  {
    id: 'courses',
    name: 'Course',
    bgColor: 'bg-blue-100',
    isActive: false,
    type: 'local',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2ZM6 4H11V12L8.5 10.5L6 12V4Z"
          fill="#1565C0"
        />
      </svg>
    ),
  },
  // {
  //   id: "blackboard",
  //   name: "Blackboard",
  //   bgColor: "bg-blue-100",
  //   isActive: true,
  //   type: "url",
  //   fileType: "blackboard",
  //   icon: (
  //     <svg
  //       width="24"
  //       height="24"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       xmlns="http://www.w3.org/2000/svg"
  //     >
  //       <path
  //         d="M18 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2ZM6 4H11V12L8.5 10.5L6 12V4Z"
  //         fill="#1565C0"
  //       />
  //     </svg>
  //   ),
  // },
];

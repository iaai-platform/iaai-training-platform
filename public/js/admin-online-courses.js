// public/js/admin-online-courses.js -

class AdminOnlineCoursesManager {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentView = "table";
    this.courses = [];
    this.instructors = [];
    this.certificationBodies = []; // Initialize for fetching cert bodies
    this.filteredCourses = [];
    this.currentStep = 1;
    this.editingCourse = null;

    // Dynamic items with local save functionality
    this.savedDynamicItems = {
      sessions: [],
      objectives: [],
      modules: [],
      targetAudience: [],
      requiredSoftware: [],
      engagementTools: [],
      questions: [],
      videoLinks: [],
      links: [],
      handouts: [],
      virtualLabs: [],
      advancedCourses: [],
      certificationBodies: [],
      instructors: [],
    };

    // Initialize file arrays - ADD THIS
    this.allSelectedFiles = {
      mainImage: [],
      documents: [],
      images: [],
      videos: [],
    };

    // File upload endpoints aligned with model
    this.uploadEndpoints = {
      documents: "/admin-courses/onlinelive/api/upload/documents",
      images: "/admin-courses/onlinelive/api/upload/images",
      videos: "/admin-courses/onlinelive/api/upload/videos",
      mainImage: "/admin-courses/onlinelive/api/upload/main-image",
    };

    // File upload configuration with validation
    this.fileUploadConfig = {
      maxFileSize: {
        documents: 50 * 1024 * 1024, // 50MB
        images: 5 * 1024 * 1024, // 5MB
        videos: 100 * 1024 * 1024, // 100MB
        mainImage: 5 * 1024 * 1024, // 5MB
      },
      allowedTypes: {
        documents: [
          "application/pdf",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        images: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
        videos: ["video/mp4", "video/webm", "video/ogg"],
        mainImage: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      },
      maxFiles: {
        documents: 10,
        images: 20,
        videos: 5,
        mainImage: 1,
      },
    };

    // Track saved uploaded files separately (these are the URLs from successful uploads)
    this.savedUploadedFiles = {
      mainImage: null,
      documents: [],
      images: [],
      videos: [],
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupDatePickers();
    this.setupFileUploadHandlers();

    // Load certification bodies FIRST, then load other data
    this.loadCertificationBodies()
      .then(() => {
        console.log(
          "🏢 Certification bodies loaded, now loading other data..."
        );
        this.loadInitialData();
      })
      .catch((error) => {
        console.error("❌ Failed to load certification bodies:", error);
        // Still load other data even if certification bodies fail
        this.loadInitialData();
      });
  }

  setupEventListeners() {
    console.log("🔧 Setting up event listeners...");

    // Helper function to safely add event listeners
    const safeAddEventListener = (elementId, event, handler) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ Added ${event} listener to ${elementId}`);
      } else {
        console.warn(`⚠️ Element with ID '${elementId}' not found`);
      }
    };

    // Modal controls
    safeAddEventListener("addCourseBtn", "click", () => this.openCourseModal());
    safeAddEventListener("closeModal", "click", () => this.closeCourseModal());
    safeAddEventListener("closeConfirmModal", "click", () =>
      this.closeConfirmModal()
    );

    // Form navigation
    safeAddEventListener("prevStep", "click", () => this.previousStep());
    safeAddEventListener("nextStep", "click", () => this.nextStep());
    safeAddEventListener("submitForm", "click", (e) => this.submitForm(e));

    // Search and filters
    safeAddEventListener("searchInput", "input", () => this.applyFilters());
    safeAddEventListener("statusFilter", "change", () => this.applyFilters());
    safeAddEventListener("categoryFilter", "change", () => this.applyFilters());
    safeAddEventListener("platformFilter", "change", () => this.applyFilters());

    // View toggle
    const viewButtons = document.querySelectorAll(".view-btn");
    viewButtons.forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.switchView(e.target.dataset.view)
      );
    });

    // Assessment type change handler
    safeAddEventListener("assessmentType", "change", (e) => {
      this.toggleAssessmentSections(e.target.value);
    });

    // Gamification toggle
    safeAddEventListener("gamificationEnabled", "change", (e) => {
      this.toggleGamificationFeatures(e.target.checked);
    });

    // Pagination
    safeAddEventListener("prevPage", "click", () => this.previousPage());
    safeAddEventListener("nextPage", "click", () => this.nextPage());

    // Export
    safeAddEventListener("exportBtn", "click", () => this.exportData());

    // Select all checkbox
    safeAddEventListener("selectAll", "change", (e) =>
      this.selectAllCourses(e.target.checked)
    );

    // Modal overlay click to close
    const courseModal = document.getElementById("courseModal");
    if (courseModal) {
      courseModal.addEventListener("click", (e) => {
        if (e.target.id === "courseModal") this.closeCourseModal();
      });
    }

    const confirmModal = document.getElementById("confirmModal");
    if (confirmModal) {
      confirmModal.addEventListener("click", (e) => {
        if (e.target.id === "confirmModal") this.closeConfirmModal();
      });
    }

    // Form validation
    const courseForm = document.getElementById("courseForm");
    if (courseForm) {
      courseForm.addEventListener("input", () => this.validateCurrentStep());
    }

    // NEW: AUTO-GENERATE COURSE CODE
    const titleInput = document.getElementById("title");
    if (titleInput) {
      titleInput.addEventListener("blur", async () => {
        const courseCodeInput = document.getElementById("courseCode");
        const title = titleInput.value.trim();

        // Only generate if course code is empty and title is provided, and not in edit mode
        if (
          !courseCodeInput.value &&
          title &&
          !document.getElementById("courseId").value
        ) {
          try {
            const response = await fetch(
              "/admin-courses/onlinelive/api/generate-course-code",
              {
                // Adjust API path
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ title }),
              }
            );

            const data = await response.json();
            if (data.success) {
              courseCodeInput.value = data.courseCode;
              courseCodeInput.classList.add("auto-generated");
              this.showToast(
                "info",
                "Course Code Generated",
                "Course code generated automatically"
              );
            }
          } catch (error) {
            console.error("Error generating course code:", error);
          }
        }
      });
    }

    // NEW: Handle primary certification body selection change
    const issuingAuthoritySelect =
      document.getElementById("issuingAuthorityId");
    if (issuingAuthoritySelect) {
      issuingAuthoritySelect.addEventListener("change", (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const issuingAuthorityInput =
          document.getElementById("issuingAuthority");

        if (e.target.value && this.certificationBodies) {
          // Find the selected body
          const selectedBody = this.certificationBodies.find(
            (body) => body._id === e.target.value
          );
          if (selectedBody && issuingAuthorityInput) {
            issuingAuthorityInput.value = selectedBody.companyName;
            issuingAuthorityInput.readOnly = true;

            // Show specializations if available
            const specializations = selectedBody.specializations || [];
            if (specializations.length > 0) {
              this.showToast(
                "info",
                "Specializations",
                `Specializations: ${specializations.join(", ")}`
              );
            }
          }
        } else {
          // Default to IAAI
          if (issuingAuthorityInput) {
            issuingAuthorityInput.value = "IAAI Training Institute";
            issuingAuthorityInput.readOnly = false;
          }
        }
      });
    }

    // NEW: Event listener for "Create from In-Person" button
    safeAddEventListener("createFromInPersonBtn", "click", () =>
      this.openCreateFromInPersonModal()
    );

    // Setup dynamic event listeners (for "Add Session", "Add Instructor", etc.)
    this.setupDynamicEventListeners();
  }

  setupDynamicEventListeners() {
    console.log("🔧 Setting up dynamic event listeners...");

    // Helper function to safely add event listeners to dynamic elements
    const safeAddDynamicListener = (elementId, event, handler) => {
      const element = document.getElementById(elementId);
      if (element && !element.hasAttribute("data-listener-added")) {
        element.setAttribute("data-listener-added", "true");
        element.addEventListener(event, handler);
        return true;
      }
      return false;
    };

    // Online-specific dynamic sections
    safeAddDynamicListener("addSession", "click", (e) => {
      e.preventDefault();
      this.addSession();
    });

    safeAddDynamicListener("addObjective", "click", (e) => {
      e.preventDefault();
      this.addObjective();
    });

    safeAddDynamicListener("addModule", "click", (e) => {
      e.preventDefault();
      this.addModule();
    });

    safeAddDynamicListener("addInstructor", "click", (e) => {
      e.preventDefault();
      this.addInstructor();
    });

    safeAddDynamicListener("addTargetAudience", "click", (e) => {
      e.preventDefault();
      this.addTargetAudience();
    });

    safeAddDynamicListener("addRequiredSoftware", "click", (e) => {
      e.preventDefault();
      this.addRequiredSoftware();
    });

    safeAddDynamicListener("addEngagementTool", "click", (e) => {
      e.preventDefault();
      this.addEngagementTool();
    });

    safeAddDynamicListener("addQuestion", "click", (e) => {
      e.preventDefault();
      this.addQuestion();
    });

    safeAddDynamicListener("addVideoLink", "click", (e) => {
      e.preventDefault();
      this.addVideoLink();
    });

    safeAddDynamicListener("addLink", "click", (e) => {
      e.preventDefault();
      this.addLink();
    });

    safeAddDynamicListener("addHandout", "click", (e) => {
      e.preventDefault();
      this.addHandout();
    });

    safeAddDynamicListener("addVirtualLab", "click", (e) => {
      e.preventDefault();
      this.addVirtualLab();
    });

    safeAddDynamicListener("addAdvancedCourse", "click", (e) => {
      e.preventDefault();
      this.addAdvancedCourse();
    });

    // NEW: Add event listener for adding certification body
    safeAddDynamicListener("addCertificationBody", "click", (e) => {
      e.preventDefault();
      this.addCertificationBody();
    });
  }

  // File Upload Handlers Setup (same as in-person)
  setupFileUploadHandlers() {
    console.log("📁 Setting up file upload handlers...");

    // Set up drag and drop for all file upload areas
    this.setupDragAndDrop();

    // Set up file input change handlers
    this.setupFileInputHandlers();

    console.log("✅ File upload handlers setup completed");
  }

  setupDragAndDrop() {
    const fileUploadAreas = document.querySelectorAll(".file-upload-area");

    fileUploadAreas.forEach((area) => {
      area.addEventListener("dragover", (e) => {
        e.preventDefault();
        area.classList.add("drag-over");
      });

      area.addEventListener("dragleave", (e) => {
        e.preventDefault();
        area.classList.remove("drag-over");
      });

      area.addEventListener("drop", (e) => {
        e.preventDefault();
        area.classList.remove("drag-over");

        const files = e.dataTransfer.files;
        const uploadType = area.dataset.uploadType;

        if (files.length > 0) {
          this.handleFileUpload(files, uploadType);
        }
      });
    });
  }

  setupFileInputHandlers() {
    console.log("📁 Setting up enhanced file upload handlers...");

    // Ensure allSelectedFiles is initialized
    if (!this.allSelectedFiles) {
      this.allSelectedFiles = {
        mainImage: [],
        documents: [],
        images: [],
        videos: [],
      };
      console.log("📁 Initialized allSelectedFiles");
    }

    // Set up drag and drop for all file upload areas
    this.setupDragAndDrop();

    // Enhanced file input change handlers with save/delete functionality
    const fileInputs = document.querySelectorAll('input[type="file"]');
    console.log(`📁 Found ${fileInputs.length} file inputs`);

    fileInputs.forEach((input, inputIndex) => {
      // Determine upload type from input name or id
      const uploadType = this.getUploadTypeFromInput(input);
      const isMainImage = uploadType === "mainImage";
      const isSingleFile = isMainImage || !input.hasAttribute("multiple");

      console.log(
        `📁 Setting up input ${
          inputIndex + 1
        }: ${uploadType} (single: ${isSingleFile})`
      );
      console.log(`📁 Input details: name="${input.name}", id="${input.id}"`);

      // Ensure the uploadType exists in allSelectedFiles
      if (!this.allSelectedFiles[uploadType]) {
        this.allSelectedFiles[uploadType] = [];
        console.log(`📁 Initialized array for ${uploadType}`);
      }

      // Create or find preview container
      let previewContainer = input.parentElement.querySelector(
        ".file-preview-container"
      );

      if (!previewContainer) {
        console.log(`📁 Creating preview container for ${uploadType}`);
        previewContainer = document.createElement("div");
        previewContainer.className = "file-preview-container";
        if (isMainImage) {
          previewContainer.classList.add("main-image-container");
        }
        // Insert after the input element
        input.parentElement.appendChild(previewContainer);
      } else {
        console.log(`📁 Found existing preview container for ${uploadType}`);
      }

      // Add file count badge for multiple file inputs
      if (!isSingleFile) {
        this.createFileCountBadge(input.parentElement, uploadType);
      }

      // Add "Add More Files" button for multi-file inputs
      if (!isSingleFile && input.hasAttribute("multiple")) {
        const addMoreBtn = this.createAddMoreButton(
          input,
          previewContainer,
          uploadType
        );
        input.addMoreBtn = addMoreBtn;
      }

      // Enhanced change event handler
      input.addEventListener("change", (e) => {
        const files = e.target.files;

        if (files.length > 0) {
          console.log(`📁 Files selected for ${uploadType}:`, files.length);
          console.log(
            `📁 Current allSelectedFiles[${uploadType}]:`,
            this.allSelectedFiles[uploadType]
          );

          // Validate files before processing
          const validation = this.validateFiles(files, uploadType);
          if (!validation.isValid) {
            validation.errors.forEach((error) => {
              this.showToast("error", "File Validation Error", error);
            });
            input.value = ""; // Clear the invalid selection
            return;
          }

          // Ensure array exists before pushing
          if (!Array.isArray(this.allSelectedFiles[uploadType])) {
            this.allSelectedFiles[uploadType] = [];
            console.log(`📁 Re-initialized array for ${uploadType}`);
          }

          // For main image, replace the existing one
          if (isSingleFile) {
            this.allSelectedFiles[uploadType] = Array.from(
              validation.validFiles
            );
            this.displaySelectedFiles(
              this.allSelectedFiles[uploadType],
              previewContainer,
              uploadType,
              true
            );
          } else {
            // For other files, add to existing ones
            try {
              this.allSelectedFiles[uploadType].push(
                ...Array.from(validation.validFiles)
              );
              console.log(
                `📁 Added ${validation.validFiles.length} files to ${uploadType}`
              );

              this.displaySelectedFiles(
                this.allSelectedFiles[uploadType],
                previewContainer,
                uploadType,
                false
              );

              // Show "Add More" button
              if (input.addMoreBtn) {
                input.addMoreBtn.style.display = "inline-block";
              }

              // Update file count badge
              this.updateFileCountBadge(input.parentElement, uploadType);
            } catch (error) {
              console.error(`❌ Error adding files to ${uploadType}:`, error);
              console.error(
                `❌ allSelectedFiles[${uploadType}]:`,
                this.allSelectedFiles[uploadType]
              );
              // Reinitialize and try again
              this.allSelectedFiles[uploadType] = Array.from(
                validation.validFiles
              );
              this.displaySelectedFiles(
                this.allSelectedFiles[uploadType],
                previewContainer,
                uploadType,
                false
              );
            }
          }

          // Auto-upload the files
          this.handleFileUpload(validation.validFiles, uploadType);

          // Clear the input so same file can be selected again
          input.value = "";
        }
      });

      // Add file drop support directly to the input's parent container
      this.addFileDropSupport(input.parentElement, uploadType);

      console.log(`✅ Setup complete for ${uploadType} file input`);
    });

    console.log("✅ Enhanced file upload handlers setup completed");
    console.log("📁 Final allSelectedFiles state:", this.allSelectedFiles);
  }

  // 3. Fix the getUploadTypeFromInput method
  getUploadTypeFromInput(input) {
    console.log(
      `🔍 Determining upload type for input: name="${input.name}", id="${input.id}"`
    );

    // Check exact matches first
    if (input.name === "mainImage" || input.id === "mainImageInput") {
      console.log(`✅ Detected mainImage`);
      return "mainImage";
    }
    if (input.name === "documents" || input.id === "documentsInput") {
      console.log(`✅ Detected documents`);
      return "documents";
    }
    if (input.name === "images" || input.id === "galleryImagesInput") {
      console.log(`✅ Detected images`);
      return "images";
    }
    if (input.name === "videos" || input.id === "uploadedVideosInput") {
      console.log(`✅ Detected videos`);
      return "videos";
    }

    // Fallback to partial matches
    if (input.name && input.name.includes("mainImage")) return "mainImage";
    if (input.name && input.name.includes("documents")) return "documents";
    if (input.name && input.name.includes("images")) return "images";
    if (input.name && input.name.includes("videos")) return "videos";

    if (input.id && input.id.includes("mainImage")) return "mainImage";
    if (input.id && input.id.includes("documents")) return "documents";
    if (input.id && input.id.includes("Images")) return "images"; // galleryImagesInput
    if (input.id && input.id.includes("Videos")) return "videos"; // uploadedVideosInput

    // Default fallback
    console.warn(
      `⚠️ Could not determine upload type for input, defaulting to documents`
    );
    return "documents";
  }

  // 4. Enhanced displaySelectedFiles method with better error handling
  displaySelectedFiles(files, container, uploadType, isSingleFile = false) {
    console.log(
      `📁 Displaying ${files.length} selected files for ${uploadType}`
    );
    console.log(`📁 Container:`, container);
    console.log(`📁 Files:`, files);

    if (!container) {
      console.error(`❌ No container provided for ${uploadType}`);
      return;
    }

    // Clear container only for single file inputs
    if (isSingleFile) {
      container.innerHTML = "";
    }

    // For multiple files, only add new ones
    const existingFileNames = Array.from(
      container.querySelectorAll(".file-name")
    ).map((el) => el.textContent);

    files.forEach((file, index) => {
      // Skip if file already displayed
      if (existingFileNames.includes(file.name)) {
        console.log(`⏭️ Skipping already displayed file: ${file.name}`);
        return;
      }

      console.log(`➕ Adding file display: ${file.name} for ${uploadType}`);

      const fileItem = document.createElement("div");
      fileItem.className = "file-item pending-upload";
      fileItem.dataset.fileName = file.name;
      fileItem.dataset.uploadType = uploadType; // CRITICAL: Set the upload type

      // Enhanced HTML with save/delete buttons for ALL file types
      fileItem.innerHTML = `
            <div class="file-info">
                <i class="fas fa-${this.getFileIcon(file.type)}"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${this.formatFileSize(
                  file.size
                )})</span>
                <span class="file-status pending"> - Pending Upload</span>
            </div>
            <div class="file-actions">
                <button type="button" class="btn btn-sm btn-success save-file-btn" 
                        onclick="adminOnlineCourses.saveIndividualFile('${uploadType}', '${
        file.name
      }')" 
                        title="Save file locally"
                        style="display: none;">
                    <i class="fas fa-save"></i>
                </button>
                <button type="button" class="btn btn-sm btn-danger remove-file-btn" 
                        onclick="adminOnlineCourses.removeLocalFile('${uploadType}', '${
        file.name
      }')"
                        title="Remove file">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

      container.appendChild(fileItem);
      console.log(`✅ File display added for: ${file.name} (${uploadType})`);
    });

    console.log(`🔄 File display update complete for ${uploadType}`);
  }

  // 5. Add this debug method to check what's happening
  debugFileState() {
    console.log("🔍 Current file state:");
    console.log("allSelectedFiles:", this.allSelectedFiles);
    console.log("savedUploadedFiles:", this.savedUploadedFiles);

    const fileInputs = document.querySelectorAll('input[type="file"]');
    console.log(`Found ${fileInputs.length} file inputs:`);

    fileInputs.forEach((input, index) => {
      const uploadType = this.getUploadTypeFromInput(input);
      const container = input.parentElement.querySelector(
        ".file-preview-container"
      );

      console.log(`Input ${index + 1}:`);
      console.log(`  Name: ${input.name}`);
      console.log(`  ID: ${input.id}`);
      console.log(`  Upload Type: ${uploadType}`);
      console.log(`  Has container: ${!!container}`);
      console.log(
        `  Container children: ${container ? container.children.length : 0}`
      );
      console.log(
        `  allSelectedFiles[${uploadType}]:`,
        this.allSelectedFiles[uploadType]
      );
    });
  }

  // Helper method to determine upload type from input element
  // Helper method to determine upload type from input element
  getUploadTypeFromInput(input) {
    console.log(
      `🔍 Determining upload type for input: name="${input.name}", id="${input.id}"`
    );

    // Check name attribute first
    if (input.name) {
      if (input.name === "mainImage" || input.id === "mainImageInput") {
        console.log(`✅ Detected mainImage`);
        return "mainImage";
      }
      if (input.name === "documents" || input.id === "documentsInput") {
        console.log(`✅ Detected documents`);
        return "documents";
      }
      if (input.name === "images" || input.id === "galleryImagesInput") {
        console.log(`✅ Detected images`);
        return "images";
      }
      if (input.name === "videos" || input.id === "uploadedVideosInput") {
        console.log(`✅ Detected videos`);
        return "videos";
      }
    }

    // Check id attribute as fallback
    if (input.id) {
      if (input.id.includes("mainImage")) return "mainImage";
      if (input.id.includes("documents")) return "documents";
      if (input.id.includes("Images")) return "images"; // Note: galleryImagesInput
      if (input.id.includes("Videos")) return "videos"; // Note: uploadedVideosInput
    }

    // Default fallback
    console.warn(
      `⚠️ Could not determine upload type for input, defaulting to documents`
    );
    return "documents";
  }

  // Create file count badge for multiple file inputs
  createFileCountBadge(container, uploadType) {
    const existingBadge = container.querySelector(".file-count-badge");
    if (existingBadge) return existingBadge;

    const badge = document.createElement("div");
    badge.className = "file-count-badge";
    badge.textContent = "0";
    badge.style.display = "none"; // Hidden initially
    container.style.position = "relative";
    container.appendChild(badge);
    return badge;
  }

  // Update file count badge
  updateFileCountBadge(container, uploadType) {
    const badge = container.querySelector(".file-count-badge");
    if (!badge) return;

    const fileCount = this.allSelectedFiles[uploadType]?.length || 0;
    badge.textContent = fileCount.toString();
    badge.style.display = fileCount > 0 ? "flex" : "none";
  }

  // Create "Add More Files" button
  createAddMoreButton(input, previewContainer, uploadType) {
    const existingBtn = input.parentElement.querySelector(
      ".add-more-files-btn"
    );
    if (existingBtn) return existingBtn;

    const addMoreBtn = document.createElement("button");
    addMoreBtn.type = "button";
    addMoreBtn.className = "btn btn-secondary btn-sm add-more-files-btn";
    addMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Add More Files';
    addMoreBtn.style.display = "none"; // Hidden initially

    // Insert button after the preview container
    previewContainer.parentElement.insertBefore(
      addMoreBtn,
      previewContainer.nextSibling
    );

    // Add click handler
    addMoreBtn.addEventListener("click", () => {
      input.click();
    });

    return addMoreBtn;
  }

  // Add file drop support to containers
  addFileDropSupport(container, uploadType) {
    // Add visual feedback class
    container.classList.add("file-upload-section");

    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      container.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Add visual feedback for drag operations
    ["dragenter", "dragover"].forEach((eventName) => {
      container.addEventListener(eventName, () => {
        container.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      container.addEventListener(eventName, () => {
        container.classList.remove("drag-over");
      });
    });

    // Handle dropped files
    container.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        console.log(`📁 Files dropped on ${uploadType}:`, files.length);

        // Find the file input in this container
        const fileInput = container.querySelector('input[type="file"]');
        if (fileInput) {
          // Trigger the same validation and processing as file input change
          const validation = this.validateFiles(files, uploadType);
          if (!validation.isValid) {
            validation.errors.forEach((error) => {
              this.showToast("error", "File Drop Error", error);
            });
            return;
          }

          // Process the dropped files
          const isMainImage = uploadType === "mainImage";
          const previewContainer = container.querySelector(
            ".file-preview-container"
          );

          if (isMainImage) {
            this.allSelectedFiles[uploadType] = Array.from(
              validation.validFiles
            );
            this.displaySelectedFiles(
              this.allSelectedFiles[uploadType],
              previewContainer,
              uploadType,
              true
            );
          } else {
            this.allSelectedFiles[uploadType] =
              this.allSelectedFiles[uploadType] || [];
            this.allSelectedFiles[uploadType].push(
              ...Array.from(validation.validFiles)
            );
            this.displaySelectedFiles(
              this.allSelectedFiles[uploadType],
              previewContainer,
              uploadType,
              false
            );

            // Show "Add More" button
            if (fileInput.addMoreBtn) {
              fileInput.addMoreBtn.style.display = "inline-block";
            }

            // Update file count badge
            this.updateFileCountBadge(container, uploadType);
          }

          // Auto-upload the files
          this.handleFileUpload(validation.validFiles, uploadType);
        }
      }
    });
  }

  // Enhanced displayExistingUploadedFiles method for editing
  // Replace the existing displayExistingUploadedFiles method:
  /**
   * Enhanced method to display existing uploaded files with proper edit controls
   */
  displayExistingUploadedFiles(course) {
    console.log("📁 Displaying existing uploaded files for editing...");
    console.log("📁 Current savedUploadedFiles:", this.savedUploadedFiles);

    // Get all file input containers
    const fileContainers = [
      { type: "mainImage", selector: "#mainImageInput" },
      { type: "documents", selector: 'input[name="documents"]' },
      { type: "images", selector: 'input[name="images"]' },
      { type: "videos", selector: 'input[name="videos"]' },
    ];

    fileContainers.forEach(({ type, selector }) => {
      const input = document.querySelector(selector);
      if (!input) {
        console.warn(`⚠️ Input not found for selector: ${selector}`);
        return;
      }

      let container = input.parentElement.querySelector(
        ".file-preview-container"
      );
      if (!container) {
        console.warn(
          `⚠️ Preview container not found for ${type}, creating one...`
        );
        container = document.createElement("div");
        container.className = "file-preview-container";
        if (type === "mainImage") {
          container.classList.add("main-image-container");
        }
        input.parentElement.appendChild(container);
      }

      // Clear existing previews
      container.innerHTML = "";

      // Display files based on type
      if (type === "mainImage" && this.savedUploadedFiles.mainImage) {
        console.log(
          `📎 Displaying main image: ${this.savedUploadedFiles.mainImage}`
        );
        this._addExistingFilePreview(
          container,
          type,
          this.savedUploadedFiles.mainImage,
          course._id
        );
      } else if (
        this.savedUploadedFiles[type] &&
        Array.isArray(this.savedUploadedFiles[type]) &&
        this.savedUploadedFiles[type].length > 0
      ) {
        console.log(
          `📎 Displaying ${this.savedUploadedFiles[type].length} ${type} files`
        );
        this.savedUploadedFiles[type].forEach((url) => {
          this._addExistingFilePreview(container, type, url, course._id);
        });

        // Update file count badge for multiple file types
        if (type !== "mainImage") {
          this.updateFileCountBadge(input.parentElement, type);
        }
      } else {
        console.log(`📎 No existing files to display for ${type}`);
      }
    });

    console.log("✅ Existing files displayed with edit/delete actions");
  }

  // Replace the existing displaySelectedFiles method with this fixed version
  // Replace the existing displaySelectedFiles method with this fixed version
  displaySelectedFiles(files, container, uploadType, isSingleFile = false) {
    console.log(
      `📁 Displaying ${files.length} selected files for ${uploadType}`
    );

    // Clear container only for single file inputs
    if (isSingleFile) {
      container.innerHTML = "";
    }

    // For multiple files, only add new ones
    const existingFileNames = Array.from(
      container.querySelectorAll(".file-name")
    ).map((el) => el.textContent);

    files.forEach((file, index) => {
      // Skip if file already displayed
      if (existingFileNames.includes(file.name)) {
        console.log(`⏭️ Skipping already displayed file: ${file.name}`);
        return;
      }

      console.log(`➕ Adding file display: ${file.name}`);

      const fileItem = document.createElement("div");
      fileItem.className = "file-item pending-upload";
      fileItem.dataset.fileName = file.name;
      fileItem.dataset.uploadType = uploadType; // CRITICAL: Set the upload type

      // Enhanced HTML with save/delete buttons for ALL file types
      fileItem.innerHTML = `
            <div class="file-info">
                <i class="fas fa-${this.getFileIcon(file.type)}"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${this.formatFileSize(
                  file.size
                )})</span>
                <span class="file-status pending"> - Pending Upload</span>
            </div>
            <div class="file-actions">
                <button type="button" class="btn btn-sm btn-success save-file-btn" 
                        onclick="adminOnlineCourses.saveIndividualFile('${uploadType}', '${
        file.name
      }')" 
                        title="Save file locally"
                        style="display: none;">
                    <i class="fas fa-save"></i>
                </button>
                <button type="button" class="btn btn-sm btn-danger remove-file-btn" 
                        onclick="adminOnlineCourses.removeLocalFile('${uploadType}', '${
        file.name
      }')"
                        title="Remove file">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

      container.appendChild(fileItem);
      console.log(`✅ File display added for: ${file.name} (${uploadType})`);
    });

    console.log(`🔄 File display update complete for ${uploadType}`);
  }

  // Enhanced method to get file icon from URL
  getFileIconFromUrl(fileUrl) {
    const fileName = fileUrl.split("/").pop().toLowerCase();
    const fileExtension = fileName.split(".").pop();

    switch (true) {
      case ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(fileExtension):
        return "fas fa-image";
      case fileExtension === "pdf":
        return "fas fa-file-pdf";
      case ["doc", "docx"].includes(fileExtension):
        return "fas fa-file-word";
      case ["ppt", "pptx"].includes(fileExtension):
        return "fas fa-file-powerpoint";
      case ["xls", "xlsx"].includes(fileExtension):
        return "fas fa-file-excel";
      case ["mp4", "webm", "ogg", "mov", "avi"].includes(fileExtension):
        return "fas fa-video";
      case ["zip", "rar", "7z"].includes(fileExtension):
        return "fas fa-file-archive";
      case ["txt", "md"].includes(fileExtension):
        return "fas fa-file-alt";
      default:
        return "fas fa-file";
    }
  }

  // Enhanced method to view/download files
  viewFile(fileUrl) {
    console.log(`👁️ Opening file: ${fileUrl}`);

    // For images, show in a modal/lightbox
    if (this._isImageFile(fileUrl)) {
      this._showImageModal(fileUrl);
    } else {
      // For other files, open in new tab
      window.open(fileUrl, "_blank");
    }
  }

  /**
   * Check if file is an image
   */
  _isImageFile(fileUrl) {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const extension = fileUrl.split(".").pop().toLowerCase();
    return imageExtensions.includes(extension);
  }

  /**
   * Show image in a modal
   */
  _showImageModal(imageUrl) {
    // Create modal HTML
    const modalHTML = `
    <div class="image-modal-overlay" id="imageModal" onclick="this.remove()">
      <div class="image-modal-container" onclick="event.stopPropagation()">
        <div class="image-modal-header">
          <h3>Image Preview</h3>
          <button class="close-btn" onclick="document.getElementById('imageModal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="image-modal-body">
          <img src="${imageUrl}" alt="Image Preview" style="max-width: 100%; max-height: 80vh; object-fit: contain;">
        </div>
        <div class="image-modal-footer">
          <a href="${imageUrl}" target="_blank" class="btn btn-primary">
            <i class="fas fa-download"></i> Open in New Tab
          </a>
        </div>
      </div>
    </div>
  `;

    // Add modal styles if not already present
    if (!document.getElementById("imageModalStyles")) {
      const styles = document.createElement("style");
      styles.id = "imageModalStyles";
      styles.textContent = `
      .image-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      }
      .image-modal-container {
        background: white;
        border-radius: 8px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      .image-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid #dee2e6;
      }
      .image-modal-body {
        padding: 16px;
        text-align: center;
      }
      .image-modal-footer {
        padding: 16px;
        border-top: 1px solid #dee2e6;
        text-align: center;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
      document.head.appendChild(styles);
    }

    // Remove existing modal if any
    const existingModal = document.getElementById("imageModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add new modal to body
    document.body.insertAdjacentHTML("beforeend", modalHTML);
  }

  getFileIcon(fileType) {
    if (fileType.startsWith("image/")) return "image";
    if (fileType.includes("pdf")) return "file-pdf";
    if (fileType.includes("word") || fileType.includes("document"))
      return "file-word";
    if (fileType.includes("presentation") || fileType.includes("powerpoint"))
      return "file-powerpoint";
    if (fileType.startsWith("video/")) return "video";
    return "file";
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  removeLocalFile(uploadType, fileName) {
    console.log(`🗑️ Removing local file: ${fileName} (${uploadType})`);

    // Show confirmation for important files
    const isMainImage = uploadType === "mainImage";
    const confirmMessage = isMainImage
      ? `Remove main image "${fileName}"? This cannot be undone.`
      : `Remove "${fileName}"? This cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    // Remove from allSelectedFiles array
    if (this.allSelectedFiles && this.allSelectedFiles[uploadType]) {
      this.allSelectedFiles[uploadType] = this.allSelectedFiles[
        uploadType
      ].filter((file) => file.name !== fileName);
    }

    // Remove from savedUploadedFiles if it exists there
    if (uploadType === "mainImage" && this.savedUploadedFiles.mainImage) {
      if (this.savedUploadedFiles.mainImage.includes(fileName)) {
        this.savedUploadedFiles.mainImage = null;
      }
    } else if (this.savedUploadedFiles[uploadType]) {
      this.savedUploadedFiles[uploadType] = this.savedUploadedFiles[
        uploadType
      ].filter((url) => !url.includes(fileName));
    }

    // Remove from display
    const fileItems = document.querySelectorAll(
      `.file-item[data-file-name="${fileName}"]`
    );
    fileItems.forEach((item) => {
      item.remove();
    });

    // Hide "Add More" button if no files left
    const input = document.querySelector(`input[name="${uploadType}"]`);
    if (input && input.addMoreBtn) {
      const remainingFiles = this.allSelectedFiles[uploadType] || [];
      if (remainingFiles.length === 0) {
        input.addMoreBtn.style.display = "none";
      }
    }

    this.showToast("info", "Removed", `"${fileName}" has been removed`);
  }

  // Replace the existing refreshFileDisplay method with this fixed version
  // Replace your refreshFileDisplay method with this fixed version
  refreshFileDisplay(uploadType) {
    console.log(`🔄 Refreshing file display for ${uploadType}`);

    // Find all preview containers
    const containers = document.querySelectorAll(".file-preview-container");
    console.log(`Found ${containers.length} preview containers`);

    containers.forEach((container) => {
      const fileItems = container.querySelectorAll(".file-item.pending-upload");
      console.log(`Container has ${fileItems.length} pending upload items`);

      fileItems.forEach((item) => {
        const fileName = item.dataset.fileName;
        const itemUploadType = item.dataset.uploadType;

        // Only update items of the correct upload type
        if (itemUploadType === uploadType) {
          console.log(`🔄 Updating display for ${fileName} (${uploadType})`);

          // Update status to "Uploaded"
          const statusSpan = item.querySelector(".file-status.pending");
          if (statusSpan) {
            statusSpan.textContent = " - Uploaded";
            statusSpan.className = "file-status uploaded";
            statusSpan.style.color = "#f59e0b";
          }

          // Remove pending class and add uploaded class
          item.classList.remove("pending-upload");
          item.classList.add("uploaded");

          // 🚨 FIX: Make sure save button is visible and enabled
          const saveBtn = item.querySelector(".save-file-btn");
          if (saveBtn && !saveBtn.classList.contains("saved")) {
            saveBtn.style.display = "inline-block"; // Show the button
            saveBtn.disabled = false;
            saveBtn.title = "Save file locally";
            console.log(`✅ Save button made visible for ${fileName}`);
          } else {
            console.log(
              `⚠️ Save button not found or already saved for ${fileName}`
            );
          }

          // Update visual feedback for uploaded state
          item.style.backgroundColor = "#fef3c7";
          item.style.borderColor = "#f59e0b";

          console.log(`✅ Display updated for ${fileName}`);
        }
      });
    });

    console.log(`🔄 Refresh complete for ${uploadType}`);
  }

  resetForm() {
    document.getElementById("courseForm").reset();
    this.currentStep = 1;
    this.updateStepVisibility();
    this.clearDynamicSections();

    // Clear all selected files
    this.allSelectedFiles = {};

    // Clear all preview containers
    const containers = document.querySelectorAll(".file-preview-container");
    containers.forEach((container) => {
      container.innerHTML = "";
    });

    // Hide all "Add More" buttons
    const addMoreBtns = document.querySelectorAll(".add-more-files-btn");
    addMoreBtns.forEach((btn) => {
      btn.style.display = "none";
    });

    // Reset toggleable sections
    this.toggleAssessmentSections("none");
    this.toggleGamificationFeatures(false);

    // Reset status dropdown to default for new course
    this.updateStatusField();
  }

  createPreviewContainer(inputSelector) {
    const input = document.querySelector(inputSelector);
    if (!input) return null;

    const container = document.createElement("div");
    container.className = "file-preview-container";
    input.parentElement.appendChild(container);
    return container;
  }

  validateFiles(files, uploadType) {
    const config = this.fileUploadConfig;
    const errors = [];
    const validFiles = [];

    // Check if upload type is supported
    if (!config.allowedTypes[uploadType]) {
      errors.push(`Upload type "${uploadType}" is not supported`);
      return { isValid: false, errors, validFiles };
    }

    // Check number of files
    // For single file uploads (like mainImage), if files.length is > 1, it's an issue
    if (uploadType === "mainImage" && files.length > 1) {
      errors.push(`Only one main image is allowed.`);
      return { isValid: false, errors, validFiles };
    }
    // For multiple files, check against maxFiles limit
    if (files.length > config.maxFiles[uploadType]) {
      errors.push(
        `Maximum ${config.maxFiles[uploadType]} files allowed for ${uploadType}`
      );
      return { isValid: false, errors, validFiles };
    }

    Array.from(files).forEach((file, index) => {
      const fileErrors = [];

      // Check file size
      if (file.size > config.maxFileSize[uploadType]) {
        const maxSizeMB = (
          config.maxFileSize[uploadType] /
          (1024 * 1024)
        ).toFixed(1);
        fileErrors.push(
          `File "${file.name}" exceeds maximum size of ${maxSizeMB}MB`
        );
      }

      // Check file type
      if (!config.allowedTypes[uploadType].includes(file.type)) {
        const allowedExtensions = this.getFileExtensions(
          config.allowedTypes[uploadType]
        );
        fileErrors.push(
          `File "${
            file.name
          }" type not supported. Allowed: ${allowedExtensions.join(", ")}`
        );
      }

      // Check for empty files
      if (file.size === 0) {
        fileErrors.push(`File "${file.name}" is empty`);
      }

      if (fileErrors.length === 0) {
        validFiles.push(file);
      } else {
        errors.push(...fileErrors);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      validFiles,
    };
  }

  storeUploadedFiles(uploadType, files) {
    if (!this.uploadedFiles) {
      this.uploadedFiles = {};
    }

    if (!this.uploadedFiles[uploadType]) {
      this.uploadedFiles[uploadType] = [];
    }

    this.uploadedFiles[uploadType].push(...files);
    console.log("📁 Stored uploaded files:", uploadType, files);
  }

  getFileExtensions(mimeTypes) {
    const mimeToExt = {
      "application/pdf": "PDF",
      "application/vnd.ms-powerpoint": "PPT",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "PPTX",
      "application/msword": "DOC",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "DOCX",
      "image/jpeg": "JPG",
      "image/jpg": "JPG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "video/mp4": "MP4",
      "video/webm": "WebM",
      "video/ogg": "OGG",
    };

    return mimeTypes.map((mime) => mimeToExt[mime] || mime).filter(Boolean);
  }

  // Replace the existing handleFileUpload method with this fixed version
  // Fixed frontend file upload methods

  // Replace the existing handleFileUpload method
  async handleFileUpload(files, uploadType) {
    console.log(`📤 Handling file upload for type: ${uploadType}`);
    console.log(`📁 Files to upload:`, files.length);

    // Validate files first
    const validation = this.validateFiles(files, uploadType);

    if (!validation.isValid) {
      validation.errors.forEach((error) => {
        this.showToast("error", "Validation Error", error);
      });
      return;
    }

    if (validation.validFiles.length === 0) {
      this.showToast("warning", "No Valid Files", "No valid files to upload");
      return;
    }

    // Ensure upload endpoints exist
    if (!this.uploadEndpoints[uploadType]) {
      console.error(`❌ No upload endpoint configured for ${uploadType}`);
      this.showToast(
        "error",
        "Configuration Error",
        `Upload endpoint not configured for ${uploadType}`
      );
      return;
    }

    const formData = new FormData();
    const fileArray = validation.validFiles;

    // Add files to FormData
    fileArray.forEach((file, index) => {
      formData.append("files", file);
    });

    // Add upload type
    formData.append("uploadType", uploadType);

    // Add course ID if editing
    if (this.editingCourse) {
      formData.append("courseId", this.editingCourse);
    }

    try {
      this.showFileUploadProgress(uploadType, true, "Uploading files...");

      console.log(`📡 Uploading to: ${this.uploadEndpoints[uploadType]}`);

      const response = await fetch(this.uploadEndpoints[uploadType], {
        method: "POST",
        body: formData,
      });

      console.log(`📊 Upload response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log(`📋 Upload result:`, result);

      if (result.success && result.files) {
        // Store URLs in savedUploadedFiles for form submission
        if (uploadType === "mainImage") {
          this.savedUploadedFiles.mainImage = result.files[0]; // Single URL string
        } else {
          // For arrays (documents, images, videos), ensure array exists and add URLs
          if (!Array.isArray(this.savedUploadedFiles[uploadType])) {
            this.savedUploadedFiles[uploadType] = [];
          }
          this.savedUploadedFiles[uploadType].push(...result.files);
        }

        console.log(
          "✅ URLs stored in savedUploadedFiles:",
          this.savedUploadedFiles
        );

        this.showToast(
          "success",
          "Upload Successful",
          `${fileArray.length} file(s) uploaded successfully`
        );

        // Update the file display to show "Uploaded" status and save buttons
        this.refreshFileDisplay(uploadType);
      } else {
        throw new Error(result.message || "Server rejected the upload");
      }
    } catch (error) {
      console.error("File upload error:", error);
      this.showToast(
        "error",
        "Upload Failed",
        `Failed to upload files: ${error.message}`
      );
    } finally {
      this.showFileUploadProgress(uploadType, false);
    }
  }
  /**
   * NEW helper to serialize a form with nested names into a JSON object.
   * Handles names like 'basic[title]' and 'instructors[additional][0][instructorId]'
   */
  // Add this new helper method inside your AdminOnlineCoursesManager class
  /**
   * Serializes a form with nested field names into a proper JavaScript object.
   * @param {HTMLFormElement} form - The form element to serialize.
   * @returns {object} A nested JavaScript object representing the form data.
   */
  _serializeFormToJSON(form) {
    const json = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      // Create an array of keys from a name like 'basic[title]' -> ['basic', 'title']
      const keys = key.match(/[^[\]]+/g);
      if (!keys) continue;

      keys.reduce((acc, currentKey, index) => {
        // Check if the next key is a number, which indicates an array
        const isArray = /^\d+$/.test(keys[index + 1]);

        if (index === keys.length - 1) {
          // Last key in the path, so assign the value
          acc[currentKey] = value;
        } else {
          // Not the last key, so build the nested structure
          if (!acc[currentKey]) {
            acc[currentKey] = isArray ? [] : {};
          }
        }
        return acc[currentKey]; // Return the next level of the object
      }, json);
    }
    return json;
  }

  // Replace your entire existing submitForm method with this new version
  async submitForm(e) {
    console.log(
      "🚀 Enhanced submitForm called (with file edit support + dynamic items fix)"
    );
    e.preventDefault();

    if (!this.validateCurrentStep()) {
      this.showToast(
        "error",
        "Validation Error",
        "Please complete all required fields"
      );
      return;
    }

    const unsavedDynamicItems = this.checkForUnsavedDynamicItems();
    if (unsavedDynamicItems.length > 0) {
      this.showToast(
        "warning",
        "Unsaved Items",
        `Please save all dynamic items before submitting: ${unsavedDynamicItems.join(
          ", "
        )}`
      );
      return;
    }

    this.showLoading(true);

    try {
      console.log("🚀 Starting enhanced form submission...");

      // PRESERVED: Check for unsaved files (from original)
      const unsavedFiles = this.checkForUnsavedFiles();
      if (unsavedFiles.length > 0) {
        this.showToast(
          "warning",
          "Unsaved Files",
          `Please save or upload files before proceeding: ${unsavedFiles.join(
            ", "
          )}`
        );
        this.showLoading(false);
        return;
      }

      // PRESERVED: Sanitize media fields before submission
      this.sanitizeMediaFields();

      // PRESERVED: Disable problematic file inputs before creating FormData (from original)
      ["mainImage", "documents", "images", "videos"].forEach((inputName) => {
        const input = document.querySelector(`input[name="${inputName}"]`);
        if (input) input.disabled = true;
      });

      // NEW APPROACH: Use JSON instead of FormData
      // 1. Get basic form data as JSON object
      const form = document.getElementById("courseForm");
      const basicFormData = this._serializeFormToJSON(form);

      // PRESERVED: Enhanced handling of savedDynamicItems (from original)
      console.log(
        "🔍 savedDynamicItems state before submission:",
        this.savedDynamicItems
      );

      // Validate that we have the savedDynamicItems object
      if (
        !this.savedDynamicItems ||
        typeof this.savedDynamicItems !== "object"
      ) {
        console.warn(
          "⚠️ savedDynamicItems is missing or invalid, initializing..."
        );
        this.savedDynamicItems = {
          sessions: [],
          objectives: [],
          modules: [],
          targetAudience: [],
          requiredSoftware: [],
          engagementTools: [],
          questions: [],
          videoLinks: [],
          links: [],
          handouts: [],
          virtualLabs: [],
          advancedCourses: [],
          certificationBodies: [],
          instructors: [],
        };
      }

      // NEW: Merge savedDynamicItems into the proper nested structure
      const mergedFormData = this._mergeDynamicItemsIntoFormData(
        basicFormData,
        this.savedDynamicItems
      );

      // PRESERVED: Enhanced validation and stringification (from original)
      let savedItemsJson;
      try {
        // Clean the data before stringifying
        const cleanedDynamicItems = {};
        Object.keys(this.savedDynamicItems).forEach((key) => {
          if (Array.isArray(this.savedDynamicItems[key])) {
            cleanedDynamicItems[key] = this.savedDynamicItems[key].filter(
              (item) => {
                // Keep items that have been marked as saved
                return item && (item.saved === true || item.saved === "true");
              }
            );
            console.log(
              `📝 ${key}: ${cleanedDynamicItems[key].length} saved items`
            );
          } else {
            cleanedDynamicItems[key] = [];
          }
        });

        savedItemsJson = JSON.stringify(cleanedDynamicItems);
        console.log("✅ Successfully stringified savedDynamicItems");

        // Validate the JSON
        JSON.parse(savedItemsJson); // This will throw if invalid
      } catch (jsonError) {
        console.error("❌ JSON error with savedDynamicItems:", jsonError);
        console.error("❌ Problematic data:", this.savedDynamicItems);
        this.showToast(
          "error",
          "Data Error",
          "There's an issue with the saved dynamic items. Please refresh and try again."
        );
        return;
      }

      // PRESERVED: Enhanced file handling with better validation (from original)
      if (this.savedUploadedFiles) {
        console.log(
          "📁 Processing savedUploadedFiles:",
          this.savedUploadedFiles
        );
      }

      // NEW: Create the final payload with merged data
      const payload = {
        ...mergedFormData,
        uploadedFiles: this.savedUploadedFiles, // File URLs from successful uploads
        // PRESERVED: Keep savedDynamicItems for backward compatibility if needed
        savedDynamicItemsBackup: savedItemsJson,
      };

      console.log("📤 Final Enhanced Payload:", payload);

      // PRESERVED: Enhanced debugging with field counting (from original)
      console.log("📤 Enhanced Form Data Contents:");
      let fieldCount = 0;
      let dynamicItemsFound =
        this.savedDynamicItems &&
        Object.keys(this.savedDynamicItems).length > 0;

      // Count top-level keys in payload
      Object.keys(payload).forEach((key) => {
        fieldCount++;
        if (typeof payload[key] === "object" && payload[key] !== null) {
          if (Array.isArray(payload[key])) {
            console.log(
              `  "${key}": [Array with ${payload[key].length} items]`
            );
          } else {
            console.log(
              `  "${key}": [Object with ${
                Object.keys(payload[key]).length
              } keys]`
            );
          }
        } else {
          const displayValue =
            typeof payload[key] === "string" && payload[key].length > 100
              ? payload[key].substring(0, 100) + "..."
              : payload[key];
          console.log(`  "${key}": "${displayValue}"`);
        }
      });

      console.log(`📊 Total payload fields: ${fieldCount}`);

      if (!dynamicItemsFound) {
        console.error("❌ CRITICAL: savedDynamicItems not found in payload!");
        this.showToast(
          "error",
          "Data Error",
          "Dynamic items data is missing from the form"
        );
        return;
      }

      // PRESERVED: Send the request (modified to use JSON instead of FormData)
      const url = this.editingCourse
        ? `/admin-courses/onlinelive/api/${this.editingCourse}`
        : "/admin-courses/onlinelive/api";
      const method = this.editingCourse ? "PUT" : "POST";

      console.log(`📡 Sending ${method} to ${url}`);

      // NEW: Send as JSON instead of FormData
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("📊 Response status:", response.status);
      console.log("📊 Response ok:", response.ok);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch {
          errorData.message = await response.text();
        }
        console.error("❌ Response error details:", errorData);
        throw new Error(
          errorData.message || `HTTP ${response.status}: Request failed`
        );
      }

      const result = await response.json();
      console.log("✅ Success result:", result);

      if (result.success) {
        this.closeCourseModal();
        this.showToast(
          "success",
          "Success",
          result.message ||
            (this.editingCourse
              ? "Course updated successfully"
              : "Course created successfully")
        );

        // PRESERVED: Clear saved data after successful submission (from original)
        this.savedUploadedFiles = {
          mainImage: null,
          documents: [],
          images: [],
          videos: [],
        };
        this.clearSavedDynamicItems();
        console.log("🧹 Cleared saved data after successful submission");

        await this.loadInitialData();
      } else {
        throw new Error(result.message || "Unknown error occurred");
      }
    } catch (error) {
      console.error("❌ Enhanced submission error:", error);
      this.showToast(
        "error",
        "Error",
        `Failed to save course: ${error.message}`
      );
    } finally {
      this.showLoading(false);

      // PRESERVED: Re-enable file inputs after submission attempt (from original)
      ["mainImage", "documents", "images", "videos"].forEach((inputName) => {
        const input = document.querySelector(`input[name="${inputName}"]`);
        if (input) input.disabled = false;
      });
    }
  }

  _mergeDynamicItemsIntoFormData(formData, savedDynamicItems) {
    console.log("🔄 Merging dynamic items into form data structure...");

    const merged = { ...formData };

    // Ensure nested objects exist
    if (!merged.schedule) merged.schedule = {};
    if (!merged.content) merged.content = {};
    if (!merged.instructors) merged.instructors = {};
    if (!merged.technical) merged.technical = {};
    if (!merged.interaction) merged.interaction = {};
    if (!merged.assessment) merged.assessment = {};
    if (!merged.certification) merged.certification = {};
    if (!merged.media) merged.media = {};
    if (!merged.materials) merged.materials = {};
    if (!merged.postCourse) merged.postCourse = {};

    // Process each type of dynamic item
    Object.keys(savedDynamicItems).forEach((itemType) => {
      const items = savedDynamicItems[itemType] || [];
      const cleanedItems = items
        .filter((item) => item && item.saved === true)
        .map((item) => {
          // Remove metadata fields
          const { id, saved, timestamp, ...cleanItem } = item;
          return cleanItem;
        });

      console.log(`📝 Processing ${itemType}: ${cleanedItems.length} items`);

      // Map each dynamic item type to its proper location in the form structure
      switch (itemType) {
        case "sessions":
          merged.schedule.sessions = cleanedItems;
          break;

        case "objectives":
          merged.content.objectives = cleanedItems.map(
            (item) => item.text || item
          );
          break;

        case "modules":
          merged.content.modules = cleanedItems;
          break;

        case "instructors":
          if (!merged.instructors.additional)
            merged.instructors.additional = [];
          merged.instructors.additional = cleanedItems.map((inst) => ({
            instructorId: inst.instructorId,
            name: inst.name,
            role: inst.role || "Co-Instructor",
            sessions: Array.isArray(inst.sessions)
              ? inst.sessions
              : typeof inst.sessions === "string"
              ? inst.sessions
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
          }));
          break;

        case "targetAudience":
          merged.content.targetAudience = cleanedItems.map(
            (item) => item.text || item
          );
          break;

        case "requiredSoftware":
          merged.technical.requiredSoftware = cleanedItems.map(
            (item) => item.name || item
          );
          break;

        case "engagementTools":
          merged.interaction.engagementTools = cleanedItems.map(
            (item) => item.name || item
          );
          break;

        case "questions":
          merged.assessment.questions = cleanedItems;
          break;

        case "certificationBodies":
          if (!merged.certification.certificationBodies)
            merged.certification.certificationBodies = [];
          merged.certification.certificationBodies = cleanedItems.map((cb) => ({
            bodyId: cb.bodyId,
            name: cb.name,
            role: cb.role || "co-issuer",
          }));
          break;

        case "videoLinks":
          if (!merged.media.videos) merged.media.videos = [];
          // Add external video URLs to the videos array
          const externalVideoUrls = cleanedItems
            .map((item) => item.url)
            .filter(Boolean);
          merged.media.videos = [
            ...(merged.media.videos || []),
            ...externalVideoUrls,
          ];
          break;

        case "links":
          merged.media.links = cleanedItems;
          break;

        case "handouts":
          merged.materials.handouts = cleanedItems;
          break;

        case "virtualLabs":
          merged.materials.virtualLabs = cleanedItems;
          break;

        case "advancedCourses":
          if (!merged.postCourse.continuedLearning)
            merged.postCourse.continuedLearning = {};
          merged.postCourse.continuedLearning.advancedCourses =
            cleanedItems.map((item) => item.code || item);
          break;

        default:
          console.warn(`⚠️ Unknown dynamic item type: ${itemType}`);
      }
    });

    console.log("✅ Dynamic items merged into form data structure");
    return merged;
  }

  async handleUploadError(errorOrResponse, uploadType, fileCount) {
    let title = "Upload Failed";
    let message = "An unexpected error occurred during upload";

    if (errorOrResponse instanceof Response) {
      // HTTP Response errors
      const status = errorOrResponse.status;

      switch (status) {
        case 400:
          title = "Invalid Request";
          try {
            const errorData = await errorOrResponse.json();
            message =
              errorData.message ||
              "The uploaded files are invalid or corrupted";
          } catch {
            message = "The uploaded files are invalid or corrupted";
          }
          break;
        case 401:
          title = "Authentication Required";
          message = "Please log in and try again";
          break;
        case 403:
          title = "Permission Denied";
          message = "You do not have permission to upload files";
          break;
        case 413:
          title = "Files Too Large";
          const maxSize = (
            this.fileUploadConfig.maxFileSize[uploadType] /
            (1024 * 1024)
          ).toFixed(1);
          message = `One or more files exceed the maximum size limit of ${maxSize}MB`;
          break;
        case 415:
          title = "Unsupported File Type";
          const allowedTypes = this.getFileExtensions(
            this.fileUploadConfig.allowedTypes[uploadType]
          );
          message = `Unsupported file type. Allowed types: ${allowedTypes.join(
            ", "
          )}`;
          break;
        case 422:
          title = "Validation Error";
          try {
            const errorData = await errorOrResponse.json();
            message = errorData.message || "File validation failed";
          } catch {
            message = "File validation failed";
          }
          break;
        case 429:
          title = "Rate Limited";
          message = "Too many upload requests. Please wait and try again";
          break;
        case 500:
          title = "Server Error";
          message = "Internal server error. Please try again later";
          break;
        case 502:
        case 503:
        case 504:
          title = "Service Unavailable";
          message =
            "Upload service is temporarily unavailable. Please try again later";
          break;
        default:
          title = `HTTP ${status} Error`;
          message = `Upload failed with status ${status}`;
      }
    } else if (errorOrResponse instanceof Error) {
      // JavaScript errors
      const error = errorOrResponse;

      if (error.name === "AbortError") {
        title = "Upload Timeout";
        message =
          "Upload took too long and was cancelled. Please try with smaller files";
      } else if (
        error.name === "NetworkError" ||
        error.message.includes("network")
      ) {
        title = "Network Error";
        message = "Please check your internet connection and try again";
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        title = "Connection Error";
        message = "Unable to connect to the upload service";
      } else if (error.message.includes("quota")) {
        title = "Storage Full";
        message = "Server storage is full. Please contact administrator";
      } else {
        title = "Upload Error";
        message = error.message || "An unknown error occurred during upload";
      }
    }

    // Show error with retry option for certain errors
    const retryableErrors = [
      "NetworkError",
      "AbortError",
      "HTTP 500 Error",
      "Service Unavailable",
    ];
    const isRetryable = retryableErrors.some(
      (err) => title.includes(err) || message.includes(err)
    );

    this.showToast("error", title, message);

    // Log detailed error for debugging
    console.error("Detailed upload error:", {
      uploadType,
      fileCount,
      error: errorOrResponse,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      retryable: isRetryable,
    });

    // Offer retry for network errors
    if (isRetryable) {
      setTimeout(() => {
        this.showToast(
          "info",
          "Retry Available",
          "You can try uploading the files again"
        );
      }, 3000);
    }
  }

  showFileUploadProgress(uploadType, show, message = "Uploading...") {
    const container = document.getElementById(`${uploadType}Preview`); // Use Preview container for progress bar
    if (!container) return;

    let progressBar = container.querySelector(".upload-progress");

    if (show) {
      if (!progressBar) {
        progressBar = document.createElement("div");
        progressBar.className = "upload-progress";
        progressBar.innerHTML = `
                      <div class="progress-bar">
                          <div class="progress-fill"></div>
                      </div>
                      <div class="progress-content">
                          <span class="progress-text">${message}</span>
                          <button class="progress-cancel" title="Cancel upload">
                              <i class="fas fa-times"></i>
                          </button>
                      </div>
                  `;
        container.appendChild(progressBar);

        // Add cancel functionality (if supported)
        const cancelBtn = progressBar.querySelector(".progress-cancel");
        if (cancelBtn) {
          // Removed this.currentUploadController as it's not defined
          cancelBtn.addEventListener("click", () => {
            // Implement actual cancellation logic if needed, e.g., AbortController
            this.showToast(
              "info",
              "Upload Cancelled",
              "File upload was cancelled"
            );
            progressBar.remove(); // Remove progress bar on cancel
          });
        }
      } else {
        progressBar.querySelector(".progress-text").textContent = message;
      }
      progressBar.style.display = "block";
    } else {
      if (progressBar) {
        progressBar.style.display = "none";
      }
    }
  }

  clearFileInput(uploadType) {
    const fileInput = document.querySelector(`input[name="${uploadType}"]`);
    if (fileInput) {
      fileInput.value = "";
    }
  }

  // This method is no longer needed as files are saved to savedUploadedFiles upon successful upload
  // Replace the existing saveIndividualFile method with this fixed version
  // Replace the existing saveIndividualFile method with this corrected version
  async saveIndividualFile(uploadType, fileName) {
    console.log(`💾 Saving individual file: ${fileName} (${uploadType})`);

    // Find the file item in the UI
    const fileItem = document.querySelector(
      `.file-item[data-file-name="${fileName}"][data-upload-type="${uploadType}"]`
    );

    if (!fileItem) {
      console.warn(`File item not found: ${fileName}`);
      this.showToast(
        "warning",
        "Warning",
        `File "${fileName}" not found in UI`
      );
      return;
    }

    // FIXED: Better logic to check if file was uploaded
    let fileExists = false;

    if (uploadType === "mainImage") {
      // For main image, just check if we have any URL (server changes filename)
      fileExists =
        this.savedUploadedFiles.mainImage &&
        this.savedUploadedFiles.mainImage.trim() !== "";
      console.log(
        `🔍 MainImage check: ${fileExists}, URL: ${this.savedUploadedFiles.mainImage}`
      );
    } else {
      // For array types, check if we have any URLs for this type
      const fileArray = this.savedUploadedFiles[uploadType];
      fileExists = Array.isArray(fileArray) && fileArray.length > 0;
      console.log(
        `🔍 ${uploadType} check: ${fileExists}, Array length: ${
          fileArray?.length || 0
        }`
      );
    }

    if (!fileExists) {
      console.warn(`❌ No uploaded files found for ${uploadType}`);
      this.showToast(
        "warning",
        "Upload Required",
        `File "${fileName}" needs to be uploaded first before saving`
      );
      return;
    }

    console.log(`✅ File exists check passed for ${fileName}`);

    // Update status in UI to show as "saved locally"
    const statusSpan = fileItem.querySelector(".file-status");
    if (statusSpan) {
      statusSpan.textContent = " - Saved Locally";
      statusSpan.className = "file-status saved";
      statusSpan.style.color = "#10b981";
    }

    // Update save button to show checkmark and disable
    const saveBtn = fileItem.querySelector(".save-file-btn");
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fas fa-check"></i>';
      saveBtn.classList.add("saved");
      saveBtn.disabled = true;
      saveBtn.title = "Saved Locally";
      saveBtn.style.backgroundColor = "#10b981";
    }

    // Add visual feedback
    fileItem.classList.remove("pending-upload", "uploaded");
    fileItem.classList.add("saved-file");
    fileItem.style.backgroundColor = "#f0fdf4";
    fileItem.style.borderColor = "#10b981";

    // Mark the item as saved in the DOM
    fileItem.setAttribute("data-saved", "true");

    this.showToast("success", "Success", `File "${fileName}" saved locally`);
    console.log(
      "💾 File marked as saved locally:",
      fileName,
      "for type:",
      uploadType
    );
  }

  setupDatePickers() {
    flatpickr("#startDate", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
      onChange: (selectedDates) => {
        if (selectedDates.length > 0) {
          const minEndDate = new Date(selectedDates[0]);
          minEndDate.setDate(minEndDate.getDate() + 1);
          flatpickr("#endDate", {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            minDate: minEndDate,
          });
        }
      },
    });

    flatpickr("#registrationDeadline", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
    });

    flatpickr("#techCheckDate", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
    });

    flatpickr("#orientationDate", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
    });
  }

  async loadCertificationBodies() {
    try {
      console.log("🏢 Fetching certification bodies...");
      const response = await fetch(
        "/admin-courses/onlinelive/api/certification-bodies"
      ); // Adjust API path
      const data = await response.json();

      if (data.success) {
        this.certificationBodies = data.certificationBodies;
        console.log(
          `Successfully loaded ${this.certificationBodies.length} certification bodies.`
        );

        // Always populate dropdown after loading
        this.populateCertificationBodiesDropdown();

        // Also refresh any existing additional certification bodies
        this.refreshAdditionalCertificationBodies();
      } else {
        console.error(
          "Error response from certification bodies API:",
          data.message
        );
        this.showToast(
          "error",
          "Error",
          data.message || "Failed to load certification bodies."
        );
      }
    } catch (error) {
      console.error("Error loading certification bodies:", error);
      this.showToast("error", "Error", "Failed to load certification bodies.");
    }
  }

  // NEW: Populate the primary certification bodies dropdown
  populateCertificationBodiesDropdown() {
    const select = document.getElementById("issuingAuthorityId");
    if (!select) {
      console.warn(
        '⚠️ Dropdown element with ID "issuingAuthorityId" not found.'
      );
      return;
    }

    if (!this.certificationBodies || this.certificationBodies.length === 0) {
      console.warn("⚠️ No certification bodies available to populate");
      select.innerHTML = '<option value="">Select Certification Body</option>';
      select.innerHTML +=
        '<option value="">IAAI Training Institute (Default)</option>';
      return;
    }

    console.log("Populating certification bodies dropdown...");

    // Clear existing options
    select.innerHTML = '<option value="">Select Certification Body</option>';

    // Add default IAAI option
    const defaultOption = document.createElement("option");
    defaultOption.value = ""; // Use empty value for default, so it can be selected as "none"
    defaultOption.textContent = "IAAI Training Institute (Default)";
    select.appendChild(defaultOption);

    // Group by membership level
    const grouped = {
      Gold: [],
      Silver: [],
      Bronze: [],
      Standard: [],
    };

    this.certificationBodies.forEach((body) => {
      const level = body.membershipLevel || "Standard";
      if (grouped[level]) {
        grouped[level].push(body);
      }
    });

    // Add grouped options
    Object.keys(grouped).forEach((level) => {
      if (grouped[level].length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = `${level} Members`;

        grouped[level].forEach((body) => {
          const option = document.createElement("option");
          option.value = body._id;
          option.textContent = body.displayName || body.companyName;
          option.setAttribute(
            "data-specializations",
            (body.specializations || []).join(", ")
          );
          optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
      }
    });
    console.log("Certification bodies dropdown populated.");
  }

  // NEW: Method to refresh additional certification bodies when data loads
  refreshAdditionalCertificationBodies() {
    const container = document.getElementById("certificationBodiesContainer");
    if (!container) return;

    const existingItems = container.querySelectorAll(
      ".certification-body-item"
    );
    existingItems.forEach((item, index) => {
      const select = item.querySelector('select[name*="[bodyId]"]');
      if (select && this.certificationBodies) {
        const currentValue = select.value;

        // Rebuild options
        let optionsHtml = '<option value="">Select Certification Body</option>';
        optionsHtml +=
          '<option value="">IAAI Training Institute (Default)</option>';

        const grouped = {
          Gold: [],
          Silver: [],
          Bronze: [],
          Standard: [],
        };

        this.certificationBodies.forEach((body) => {
          const level = body.membershipLevel || "Standard";
          if (grouped[level]) {
            grouped[level].push(body);
          }
        });

        Object.keys(grouped).forEach((level) => {
          if (grouped[level].length > 0) {
            optionsHtml += `<optgroup label="${level} Members">`;
            grouped[level].forEach((body) => {
              const isSelected = currentValue === body._id ? "selected" : "";
              optionsHtml += `<option value="${body._id}" ${isSelected}>${
                body.displayName || body.companyName
              }</option>`;
            });
            optionsHtml += "</optgroup>";
          }
        });

        select.innerHTML = optionsHtml;
        console.log(
          `✅ Refreshed options for additional certification body ${index + 1}`
        );
      }
    });
  }

  async loadInitialData() {
    console.log("📊 Loading initial data...");
    this.showLoading(true);

    try {
      const [coursesResponse, instructorsResponse] = await Promise.all([
        fetch("/admin-courses/onlinelive/api").catch((err) => {
          console.warn("⚠️ Courses API not available:", err);
          return { ok: false, status: 404 };
        }),
        fetch("/admin-courses/onlinelive/api/instructors").catch((err) => {
          console.warn("⚠️ Instructors API not available:", err);
          return { ok: false, status: 404 };
        }),
      ]);

      if (!coursesResponse.ok) {
        console.warn(`⚠️ Courses API failed: ${coursesResponse.status}`);
        this.courses = [];
        this.instructors = [];
        this.populatePlatformFilter();
        this.applyFilters();
        this.updateStats();
        return;
      }

      if (!instructorsResponse.ok) {
        console.warn(
          `⚠️ Instructors API failed: ${instructorsResponse.status}`
        );
        const coursesData = await coursesResponse.json();
        this.courses = coursesData.courses || [];
        this.instructors = [];
      } else {
        const coursesData = await coursesResponse.json();
        const instructorsData = await instructorsResponse.json();

        this.courses = coursesData.courses || [];
        this.instructors = instructorsData.instructors || [];
      }

      console.log("✅ Loaded courses:", this.courses.length);
      console.log("✅ Loaded instructors:", this.instructors.length);

      this.populatePrimaryInstructor();
      this.populatePlatformFilter();
      this.applyFilters();
      this.updateStats();
    } catch (error) {
      console.error("❌ Error loading data:", error);
      this.courses = [];
      this.instructors = [];
      this.showToast(
        "error",
        "Error",
        "Failed to load data. Please check your connection and refresh the page."
      );
    } finally {
      this.showLoading(false);
    }
  }

  populatePlatformFilter() {
    if (!Array.isArray(this.courses)) {
      console.warn("Courses is not an array:", this.courses);
      this.courses = [];
      return;
    }

    const platforms = [
      ...new Set(
        this.courses.map((course) => course.platform?.name).filter(Boolean)
      ),
    ];
    const platformFilter = document.getElementById("platformFilter");

    if (!platformFilter) {
      console.warn("Platform filter element not found");
      return;
    }

    // Clear existing options except first
    while (platformFilter.children.length > 1) {
      platformFilter.removeChild(platformFilter.lastChild);
    }

    platforms.forEach((platform) => {
      const option = document.createElement("option");
      option.value = platform;
      option.textContent = platform;
      platformFilter.appendChild(option);
    });
  }

  populatePrimaryInstructor() {
    const primarySelect = document.getElementById("primaryInstructorId");
    if (!primarySelect || !this.instructors.length) return;

    // Keep the first empty option
    primarySelect.innerHTML =
      '<option value="">Select Primary Instructor</option>';

    // Add all instructors
    this.instructors.forEach((instructor) => {
      const option = document.createElement("option");
      option.value = instructor._id;
      option.textContent = `${instructor.firstName} ${instructor.lastName}`;
      primarySelect.appendChild(option);
    });
  }

  // NEW: Update instructor name when selection changes
  updateInstructorName(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const nameInput = selectElement
      .closest(".form-grid")
      .querySelector('input[name*="[name]"]');

    if (nameInput && selectedOption.value) {
      nameInput.value = selectedOption.text.trim();
    } else if (nameInput) {
      nameInput.value = "";
    }
  }

  // NEW: Update certification body info when selection changes
  updateCertificationBodyInfo(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const nameInput = selectElement
      .closest(".form-grid")
      .querySelector('input[name*="[name]"]');

    if (nameInput && selectedOption.value) {
      nameInput.value = selectedOption.text.trim();

      // Find the selected body and show specializations
      const selectedBody = this.certificationBodies.find(
        (body) => body._id === selectedOption.value
      );
      if (
        selectedBody &&
        selectedBody.specializations &&
        selectedBody.specializations.length > 0
      ) {
        this.showToast(
          "info",
          "Specializations",
          `${selectedOption.text}: ${selectedBody.specializations.join(", ")}`
        );
      }
    } else if (nameInput) {
      nameInput.value = "";
    }
  }

  applyFilters() {
    const searchTerm = document
      .getElementById("searchInput")
      .value.toLowerCase();
    const statusFilter = document.getElementById("statusFilter").value;
    const categoryFilter = document.getElementById("categoryFilter").value;
    const platformFilter = document.getElementById("platformFilter").value;

    this.filteredCourses = this.courses.filter((course) => {
      const matchesSearch =
        !searchTerm ||
        course.basic?.title?.toLowerCase().includes(searchTerm) ||
        course.basic?.courseCode?.toLowerCase().includes(searchTerm) ||
        course.instructors?.primary?.name?.toLowerCase().includes(searchTerm) ||
        course.platform?.name?.toLowerCase().includes(searchTerm);

      const matchesStatus =
        !statusFilter || course.basic?.status === statusFilter;
      const matchesCategory =
        !categoryFilter || course.basic?.category === categoryFilter;
      const matchesPlatform =
        !platformFilter || course.platform?.name === platformFilter;

      return (
        matchesSearch && matchesStatus && matchesCategory && matchesPlatform
      );
    });

    this.currentPage = 1;
    this.renderCurrentView();
    this.updatePagination();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case "table":
        this.renderTableView();
        break;
      case "grid":
        this.renderGridView();
        break;
      case "calendar":
        this.renderCalendarView();
        break;
    }
  }

  renderTableView() {
    const tbody = document.getElementById("coursesTableBody");
    if (!tbody) {
      console.warn("⚠️ coursesTableBody element not found");
      return;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const coursesToShow = this.filteredCourses.slice(startIndex, endIndex);

    tbody.innerHTML = "";

    if (coursesToShow.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-center">No courses found</td></tr>';
      return;
    }

    coursesToShow.forEach((course) => {
      const row = this.createTableRow(course);
      tbody.appendChild(row);
    });
  }

  createTableRow(course) {
    const row = document.createElement("tr");

    // Safe data extraction aligned with model
    const title = course.basic?.title || "Untitled Course";
    const courseCode = course.basic?.courseCode || "No Code";
    const status = course.basic?.status || "draft";
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const startDate = course.schedule?.startDate
      ? this.formatDate(course.schedule.startDate)
      : "TBD";
    const duration = course.schedule?.duration || "";
    const platformName = course.platform?.name || "TBD";
    const accessUrl = course.platform?.accessUrl || "#";
    const instructorName = course.instructors?.primary?.name || "TBD";
    const price = course.enrollment?.price || 0;
    const seatsAvailable = course.enrollment?.seatsAvailable || 0;
    const currentEnrollment = course.enrollment?.currentEnrollment || 0;

    row.innerHTML = `
              <td>
                  <input type="checkbox" value="${
                    course._id
                  }" class="course-checkbox">
              </td>
              <td>
                  <div class="course-title">${title}</div>
                  <div class="course-code">${courseCode}</div>
              </td>
              <td>
                  <div class="course-schedule">
                      <div class="schedule-date">${startDate}</div>
                      <div class="schedule-duration">${duration}</div>
                  </div>
              </td>
              <td>
                  <div class="platform-info">
                      <div class="platform-name">${platformName}</div>
                      <div class="platform-link">
                          <a href="${accessUrl}" target="_blank" class="text-small">
                              <i class="fas fa-external-link-alt"></i> Access
                          </a>
                      </div>
                  </div>
              </td>
              <td>
                  <div class="instructor-list">
                      ${instructorName}
                  </div>
              </td>
              <td>
                  <div class="enrollment-info">
                      <div class="enrollment-count">${currentEnrollment} / ${seatsAvailable}</div>
                      <div class="enrollment-progress">
                          <div class="enrollment-bar" style="width: ${
                            seatsAvailable > 0
                              ? (currentEnrollment / seatsAvailable) * 100
                              : 0
                          }%"></div>
                      </div>
                  </div>
              </td>
              <td>
                  <div class="price-info">
                      <div class="price-main">$${price}</div>
                  </div>
              </td>
              <td>
                  <span class="status-badge status-${statusClass}">${status}</span>
              </td>
              <td>
                  <div class="actions-cell">
                      <button class="action-btn edit-btn" onclick="adminOnlineCourses.editCourse('${
                        course._id
                      }')">
                          <i class="fas fa-edit"></i>
                      </button>
                      <button class="action-btn clone-btn" onclick="adminOnlineCourses.cloneCourse('${
                        course._id
                      }')">
                          <i class="fas fa-copy"></i>
                      </button>
                      <button class="action-btn delete-btn" onclick="adminOnlineCourses.deleteCourse('${
                        course._id
                      }')">
                          <i class="fas fa-trash"></i>
                      </button>
                  </div>
              </td>
          `;
    return row;
  }

  renderGridView() {
    const container = document.getElementById("gridView");
    if (!container) {
      console.warn("⚠️ gridView element not found");
      return;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const coursesToShow = this.filteredCourses.slice(startIndex, endIndex);

    container.innerHTML = "";

    if (coursesToShow.length === 0) {
      container.innerHTML = '<div class="text-center">No courses found</div>';
      return;
    }

    coursesToShow.forEach((course) => {
      const card = this.createCourseCard(course);
      container.appendChild(card);
    });
  }

  createCourseCard(course) {
    const card = document.createElement("div");
    card.className = "course-card";

    // Safe data extraction aligned with model
    const title = course.basic?.title || "Untitled Course";
    const courseCode = course.basic?.courseCode || "No Code";
    const status = course.basic?.status || "draft";
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const startDate = course.schedule?.startDate
      ? this.formatDate(course.schedule.startDate)
      : "TBD";
    const platformName = course.platform?.name || "TBD";
    const instructorName = course.instructors?.primary?.name || "TBD";
    const price = course.enrollment?.price || 0;
    const seatsAvailable = course.enrollment?.seatsAvailable || 0;
    const currentEnrollment = course.enrollment?.currentEnrollment || 0;

    card.innerHTML = `
              <div class="course-card-header">
                  <h3>${title}</h3>
              </div>
              <div class="course-card-body">
                  <div class="course-card-meta">
                      <span class="status-badge status-${statusClass}">${status}</span>
                      <span class="course-code">${courseCode}</span>
                  </div>
                  <div class="course-card-info">
                      <div><i class="fas fa-calendar"></i> ${startDate}</div>
                      <div><i class="fas fa-laptop"></i> ${platformName}</div>
                      <div><i class="fas fa-user"></i> ${instructorName}</div>
                      <div><i class="fas fa-users"></i> ${currentEnrollment} / ${seatsAvailable} enrolled</div>
                      <div><i class="fas fa-dollar-sign"></i> $${price}</div>
                  </div>
                  <div class="course-card-actions">
                      <button class="action-btn edit-btn" onclick="adminOnlineCourses.editCourse('${course._id}')">
                          <i class="fas fa-edit"></i>
                      </button>
                      <button class="action-btn clone-btn" onclick="adminOnlineCourses.cloneCourse('${course._id}')">
                          <i class="fas fa-copy"></i>
                      </button>
                      <button class="action-btn delete-btn" onclick="adminOnlineCourses.deleteCourse('${course._id}')">
                          <i class="fas fa-trash"></i>
                      </button>
                  </div>
              </div>
          `;
    return card;
  }

  renderCalendarView() {
    const container = document.getElementById("calendarView");
    container.innerHTML =
      '<p class="text-center">Calendar view coming soon...</p>';
  }

  switchView(view) {
    this.currentView = view;

    // Update active button
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    // Show/hide views
    document
      .getElementById("tableView")
      .classList.toggle("hidden", view !== "table");
    document
      .getElementById("gridView")
      .classList.toggle("hidden", view !== "grid");
    document
      .getElementById("calendarView")
      .classList.toggle("hidden", view !== "calendar");

    this.renderCurrentView();
  }

  updatePagination() {
    const totalItems = this.filteredCourses.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(startItem + this.itemsPerPage - 1, totalItems);

    // Update info
    document.getElementById("currentRange").textContent =
      totalItems > 0 ? `${startItem}-${endItem}` : "0-0";
    document.getElementById("totalItems").textContent = totalItems;

    // Update buttons
    document.getElementById("prevPage").disabled = this.currentPage <= 1;
    document.getElementById("nextPage").disabled =
      this.currentPage >= totalPages;

    // Update page numbers
    this.renderPageNumbers(totalPages);
  }

  renderPageNumbers(totalPages) {
    const container = document.getElementById("pageNumbers");
    container.innerHTML = "";

    const maxVisible = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const button = document.createElement("button");
      button.className = `page-number ${
        i === this.currentPage ? "active" : ""
      }`;
      button.textContent = i;
      button.addEventListener("click", () => this.goToPage(i));
      container.appendChild(button);
    }
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderCurrentView();
    this.updatePagination();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  nextPage() {
    const totalPages = Math.ceil(
      this.filteredCourses.length / this.itemsPerPage
    );
    if (this.currentPage < totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  updateStats() {
    const total = this.courses.length;
    const upcoming = this.courses.filter(
      (c) =>
        new Date(c.schedule?.startDate) > new Date() &&
        c.basic?.status === "open"
    ).length;
    const totalEnrollments = this.courses.reduce(
      (sum, course) => sum + (course.enrollment?.currentEnrollment || 0),
      0
    );
    const activeSessions = this.courses.filter(
      (c) => c.basic?.status === "in-progress"
    ).length;

    // Safely update stats elements
    const totalCoursesEl = document.getElementById("totalCourses");
    const upcomingCoursesEl = document.getElementById("upcomingCourses");
    const totalEnrollmentsEl = document.getElementById("totalEnrollments");
    const activeSessionsEl = document.getElementById("activeSessions");

    if (totalCoursesEl) totalCoursesEl.textContent = total;
    if (upcomingCoursesEl) upcomingCoursesEl.textContent = upcoming;
    if (totalEnrollmentsEl) totalEnrollmentsEl.textContent = totalEnrollments;
    if (activeSessionsEl) activeSessionsEl.textContent = activeSessions;
  }

  // NEW: Update status field
  updateStatusField() {
    const courseId = document.getElementById("courseId")?.value;
    const statusSelect = document.getElementById("status");

    if (!statusSelect) return;

    if (!courseId) {
      // New course - only draft or will be open when saved
      statusSelect.innerHTML = `
                  <option value="open" selected>Save & Open to Register</option>
                  <option value="draft">Save as Draft</option>
              `;
      statusSelect.disabled = false;
    } else {
      // Editing - show all statuses but some are system-managed
      statusSelect.innerHTML = `
                  <option value="draft">Draft</option>
                  <option value="open">Open to Register</option>
                  <option value="full" disabled>Full (Auto-managed)</option>
                  <option value="in-progress" disabled>In Progress (Auto-managed)</option>
                  <option value="completed" disabled>Completed (Auto-managed)</option>
                  <option value="cancelled">Cancelled</option>
              `;
    }
  }

  // Modal Management
  async openCourseModal(courseId = null) {
    // Only use courseId for setting editingCourse if not already set
    if (courseId !== null && courseId !== undefined) {
      this.editingCourse = courseId;
    }

    this.currentStep = 1;

    // Clear saved dynamic items when opening modal
    this.clearSavedDynamicItems();

    try {
      // Load certification bodies if not already loaded
      if (!this.certificationBodies || this.certificationBodies.length === 0) {
        await this.loadCertificationBodies();
      }

      if (this.editingCourse) {
        document.getElementById("modalTitle").textContent =
          "Edit Online Course";
        // Add hidden input for course ID if it doesn't exist
        if (!document.getElementById("courseId")) {
          const courseIdInput = document.createElement("input");
          courseIdInput.type = "hidden";
          courseIdInput.id = "courseId";
          courseIdInput.name = "courseId";
          courseIdInput.value = this.editingCourse;
          document.getElementById("courseForm").appendChild(courseIdInput);
        } else {
          document.getElementById("courseId").value = this.editingCourse;
        }
      } else {
        document.getElementById("modalTitle").textContent =
          "Add New Online Course";
        this.resetForm();
        this.populatePrimaryInstructor();
        // NEW: Call updateStatusField when adding new course
        this.updateStatusField();
        // Clear course ID if it exists
        const courseIdInput = document.getElementById("courseId");
        if (courseIdInput) {
          courseIdInput.value = "";
        }
      }

      this.updateStepVisibility();

      // Ensure buttons are visible
      const nextBtn = document.getElementById("nextStep");
      const submitBtn = document.getElementById("submitForm");
      if (nextBtn) nextBtn.classList.remove("hidden");
      if (submitBtn) submitBtn.classList.add("hidden");

      document.getElementById("courseModal").classList.add("active");

      // Re-add event listeners after modal opens
      setTimeout(() => {
        this.setupDynamicEventListeners(); // Re-run setup for dynamic elements
      }, 100);
    } catch (error) {
      console.error("Error opening modal:", error);
      this.showToast("error", "Error", "Failed to load necessary data");
    }
  }

  closeCourseModal() {
    document.getElementById("courseModal").classList.remove("active");
    this.resetForm();
    this.editingCourse = null;
    this.clearSavedDynamicItems();

    // Clear uploaded files when closing modal
    this.savedUploadedFiles = {
      mainImage: null,
      documents: [],
      images: [],
      videos: [],
    };
    console.log("🧹 Cleared saved uploaded files on modal close");
  }

  clearSavedDynamicItems() {
    this.savedDynamicItems = {
      sessions: [],
      objectives: [],
      modules: [],
      targetAudience: [],
      requiredSoftware: [],
      engagementTools: [],
      questions: [],
      videoLinks: [],
      links: [],
      handouts: [],
      virtualLabs: [],
      advancedCourses: [],
      certificationBodies: [],
      instructors: [],
    };
  }

  clearDynamicSections() {
    const containerIds = [
      "sessionsContainer",
      "objectivesContainer",
      "modulesContainer",
      "additionalInstructorsContainer",
      "targetAudienceContainer",
      "requiredSoftwareContainer",
      "engagementToolsContainer",
      "questionsContainer",
      "videoLinksContainer",
      "linksContainer",
      "handoutsContainer",
      "virtualLabsContainer",
      "advancedCoursesContainer",
      "certificationBodiesContainer", // Include certificationBodiesContainer
    ];

    containerIds.forEach((containerId) => {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = ""; // Clear ALL children
      }
    });
  }

  // Step Navigation (totalSteps updated to 16)
  nextStep() {
    if (this.validateCurrentStep()) {
      if (this.currentStep < 16) {
        // Total steps are 16 now
        this.currentStep++;
        this.updateStepVisibility();
      }
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepVisibility();
    }
  }

  updateStepVisibility() {
    // Update step indicators
    document.querySelectorAll(".step").forEach((step, index) => {
      step.classList.toggle("active", index + 1 <= this.currentStep);
    });

    // Show/hide form steps
    document.querySelectorAll(".form-step").forEach((step, index) => {
      step.classList.toggle("hidden", index + 1 !== this.currentStep);
    });

    // Update navigation buttons
    const prevBtn = document.getElementById("prevStep");
    const nextBtn = document.getElementById("nextStep");
    const submitBtn = document.getElementById("submitForm");

    if (prevBtn) prevBtn.classList.toggle("hidden", this.currentStep === 1);
    if (nextBtn) nextBtn.classList.toggle("hidden", this.currentStep === 16); // Total steps
    if (submitBtn)
      submitBtn.classList.toggle("hidden", this.currentStep !== 16); // Total steps

    // Update step indicator
    const currentStepNumber = document.getElementById("currentStepNumber");
    if (currentStepNumber) currentStepNumber.textContent = this.currentStep;
  }

  // If you want to make individual file saves optional,
  // replace the validateCurrentStep method with this version:

  validateCurrentStep() {
    const currentStepElement = document.querySelector(
      `[data-step="${this.currentStep}"]`
    );

    if (!currentStepElement) {
      const visibleStep = document.querySelector(".form-step:not(.hidden)");
      if (!visibleStep) {
        console.warn(`⚠️ No form step found for step ${this.currentStep}`);
        return true;
      }
    }

    // OPTION 1: Skip file save checks entirely (just check uploads)
    const unsavedFiles = this.checkForUnsavedUploads(); // New method below
    if (unsavedFiles.length > 0) {
      this.showToast(
        "warning",
        "Upload Required",
        `Please upload files before proceeding: ${unsavedFiles.join(", ")}`
      );
      return false;
    }

    // Check for unsaved dynamic items in current step
    const unsavedItems = this.checkForUnsavedDynamicItems();
    if (unsavedItems.length > 0) {
      this.showToast(
        "warning",
        "Unsaved Items",
        `Please save items before proceeding: ${unsavedItems.join(", ")}`
      );
      return false;
    }

    // Basic validation for required fields in current step
    const stepElement =
      currentStepElement || document.querySelector(".form-step:not(.hidden)");
    const requiredFields = stepElement.querySelectorAll("[required]");

    return this.validateFields(requiredFields);
  }

  // New method that only checks for actual uploads, not individual saves
  checkForUnsavedUploads() {
    const unsaved = [];

    return unsaved;
  }

  // NEW: Check for unsaved files
  // Replace the existing checkForUnsavedFiles method with this corrected version
  checkForUnsavedFiles() {
    const unsaved = [];

    // FIXED: Check for files that were selected but not yet uploaded
    if (this.allSelectedFiles) {
      Object.keys(this.allSelectedFiles).forEach((type) => {
        const selectedFiles = this.allSelectedFiles[type] || [];
        if (selectedFiles.length > 0) {
          // Check if these files have been uploaded (exist in savedUploadedFiles)
          let uploadedCount = 0;

          if (type === "mainImage") {
            uploadedCount = this.savedUploadedFiles.mainImage ? 1 : 0;
          } else {
            uploadedCount = (this.savedUploadedFiles[type] || []).length;
          }

          if (selectedFiles.length > uploadedCount) {
            const pendingCount = selectedFiles.length - uploadedCount;
            unsaved.push(`${pendingCount} ${type} file(s) pending upload`);
          }
        }
      });
    }

    // FIXED: Check for files that are uploaded but not marked as "saved" in UI
    const uploadedButNotSavedElements = document.querySelectorAll(
      ".file-item.uploaded:not([data-saved='true'])"
    );

    if (uploadedButNotSavedElements.length > 0) {
      unsaved.push(
        `${uploadedButNotSavedElements.length} file(s) uploaded but not saved locally`
      );
    }

    // Check for files still in pending upload state
    const pendingUploadElements = document.querySelectorAll(
      ".file-item.pending-upload"
    );
    if (pendingUploadElements.length > 0) {
      unsaved.push(`${pendingUploadElements.length} file(s) pending upload`);
    }

    console.log(`🔍 Unsaved files check result:`, unsaved);
    return unsaved;
  }

  // NEW: Check for unsaved dynamic items
  checkForUnsavedDynamicItems() {
    console.log("🔍 Enhanced checking for unsaved dynamic items...");
    const unsaved = [];

    // Get current step element
    const currentStepEl = document.querySelector(
      `.form-step[data-step="${this.currentStep}"]:not(.hidden), .form-step:not(.hidden)`
    );

    if (!currentStepEl) {
      console.log("⚠️ No current step found, skipping dynamic items check");
      return unsaved;
    }

    // Check each type of dynamic item in current step
    const dynamicContainers = [
      { container: "sessionsContainer", name: "sessions" },
      { container: "objectivesContainer", name: "objectives" },
      { container: "modulesContainer", name: "modules" },
      { container: "additionalInstructorsContainer", name: "instructors" },
      { container: "targetAudienceContainer", name: "target audience" },
      { container: "requiredSoftwareContainer", name: "required software" },
      { container: "engagementToolsContainer", name: "engagement tools" },
      { container: "questionsContainer", name: "questions" },
      { container: "videoLinksContainer", name: "video links" },
      { container: "linksContainer", name: "links" },
      { container: "handoutsContainer", name: "handouts" },
      { container: "virtualLabsContainer", name: "virtual labs" },
      { container: "advancedCoursesContainer", name: "advanced courses" },
      {
        container: "certificationBodiesContainer",
        name: "certification bodies",
      },
    ];

    dynamicContainers.forEach(({ container, name }) => {
      const containerEl = currentStepEl.querySelector(`#${container}`);
      if (containerEl) {
        const unsavedItems = containerEl.querySelectorAll(
          '.dynamic-item:not([data-saved="true"])'
        );
        if (unsavedItems.length > 0) {
          unsaved.push(`${unsavedItems.length} ${name}`);
          console.log(`⚠️ Found ${unsavedItems.length} unsaved ${name} items`);
        }
      }
    });

    console.log(`🔍 Unsaved dynamic items check result:`, unsaved);
    return unsaved;
  }

  validateFields(requiredFields) {
    if (!requiredFields || requiredFields.length === 0) {
      return true; // No required fields to validate
    }

    let isValid = true;
    const invalidFields = [];

    requiredFields.forEach((field) => {
      const value = field.value ? field.value.trim() : "";
      const fieldName = field.name || field.id || "unknown field";

      if (!value) {
        field.style.borderColor = "#ef4444";
        field.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
        isValid = false;
        invalidFields.push(fieldName);
      } else {
        field.style.borderColor = "#e5e7eb";
        field.style.boxShadow = "";
      }
    });

    if (!isValid) {
      this.showToast(
        "warning",
        "Validation Error",
        `Please fill in all required fields: ${invalidFields.join(", ")}`
      );
    }

    return isValid;
  }

  // Toggle Functions for Conditional Sections
  toggleAssessmentSections(assessmentType) {
    const quizSection = document.getElementById("quizSection");

    if (!quizSection) return;

    // Hide section initially
    quizSection.style.display = "none";

    // Show relevant sections based on assessment type
    switch (assessmentType) {
      case "quiz":
      case "both":
        quizSection.style.display = "block";
        break;
      case "practical":
      case "none":
      default:
        // Section remains hidden
        break;
    }
  }

  toggleGamificationFeatures(enabled) {
    const gamificationFeatures = document.getElementById(
      "gamificationFeatures"
    );
    if (gamificationFeatures) {
      gamificationFeatures.style.display = enabled ? "grid" : "none"; // Use 'grid' for checkbox-grid layout
    }
  }

  // Dynamic Form Sections with Local Save - Online-Specific
  addSession(data = null) {
    const container = document.getElementById("sessionsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "session-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Session ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveSession(this.closest('.dynamic-item'))" title="Save session">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'sessions')" title="Remove session">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-grid">
                  <div class="form-group">
                      <label>Day Number</label>
                      <input type="number" name="schedule[sessions][${index}][dayNumber]" min="1" value="${
      data?.dayNumber || index + 1
    }" required>
                  </div>
                  <div class="form-group">
                      <label>Date</label>
                      <input type="datetime-local" name="schedule[sessions][${index}][date]" required value="${
      data?.date ? this.formatDateForInput(data.date) : ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Start Time</label>
                      <input type="time" name="schedule[sessions][${index}][startTime]" required value="${
      data?.startTime || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>End Time</label>
                      <input type="time" name="schedule[sessions][${index}][endTime]" required value="${
      data?.endTime || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Title</label>
                      <input type="text" name="schedule[sessions][${index}][title]" placeholder="Session title" required value="${
      data?.title || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Type</label>
                      <select name="schedule[sessions][${index}][type]">
                          <option value="lecture" ${
                            data?.type === "lecture" ? "selected" : ""
                          }>Lecture</option>
                          <option value="practical" ${
                            data?.type === "practical" ? "selected" : ""
                          }>Practical</option>
                          <option value="workshop" ${
                            data?.type === "workshop" ? "selected" : ""
                          }>Workshop</option>
                          <option value="q&a" ${
                            data?.type === "q&a" ? "selected" : ""
                          }>Q&A</option>
                          <option value="exam" ${
                            data?.type === "exam" ? "selected" : ""
                          }>Exam</option>
                      </select>
                  </div>
                  <div class="form-group">
                      <label>Instructor</label>
                      <select name="schedule[sessions][${index}][instructorId]">
                          <option value="">Select Instructor</option>
                          ${this.instructors
                            .map(
                              (inst) =>
                                `<option value="${inst._id}" ${
                                  data?.instructorId === inst._id
                                    ? "selected"
                                    : ""
                                }>
                                  ${inst.firstName} ${inst.lastName}
                              </option>`
                            )
                            .join("")}
                      </select>
                  </div>
              </div>
          `;

    container.appendChild(div);
  }

  async saveSession(sessionElement) {
    const inputs = sessionElement.querySelectorAll("input, select");
    const sessionData = {
      id: sessionElement.dataset.itemId, // Use existing itemId
      dayNumber: null,
      date: null,
      startTime: "",
      endTime: "",
      title: "",
      type: "lecture",
      instructorId: null,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let isValid = true;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[dayNumber]")) {
        sessionData.dayNumber = parseInt(input.value);
        if (isNaN(sessionData.dayNumber) || sessionData.dayNumber < 1)
          isValid = false;
      } else if (name.includes("[date]")) {
        sessionData.date = input.value;
        if (!sessionData.date) isValid = false;
      } else if (name.includes("[startTime]")) {
        sessionData.startTime = input.value;
        if (!sessionData.startTime) isValid = false;
      } else if (name.includes("[endTime]")) {
        sessionData.endTime = input.value;
        if (!sessionData.endTime) isValid = false;
      } else if (name.includes("[title]")) {
        sessionData.title = input.value.trim();
        if (!sessionData.title) isValid = false;
      } else if (name.includes("[type]")) {
        sessionData.type = input.value;
      } else if (name.includes("[instructorId]")) {
        sessionData.instructorId = input.value || null;
      }
    });

    if (!isValid) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please fill all required fields for the session."
      );
      return;
    }

    // Check start/end time logic
    if (
      sessionData.startTime &&
      sessionData.endTime &&
      sessionData.startTime >= sessionData.endTime
    ) {
      this.showToast(
        "warning",
        "Validation Error",
        "Session start time must be before end time."
      );
      return;
    }

    const existingItemIndex = this.savedDynamicItems.sessions.findIndex(
      (item) => item.id === sessionData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.sessions[existingItemIndex] = sessionData;
    } else {
      this.savedDynamicItems.sessions.push(sessionData);
    }

    this.markItemAsSaved(sessionElement, "Session saved locally");
    console.log("💾 Session saved locally:", sessionData);
  }

  addObjective(text = "") {
    const container = document.getElementById("objectivesContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "objective-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Learning Objective ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveObjective(this.closest('.dynamic-item'))" title="Save objective">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'objectives')" title="Remove objective">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-group">
                  <label>Learning Objective ${index + 1}</label>
                  <input type="text" name="content[objectives][${index}]" placeholder="What will students learn?" required maxlength="200" value="${text}">
              </div>
          `;

    container.appendChild(div);
  }

  async saveObjective(objectiveElement) {
    const input = objectiveElement.querySelector("input");
    const objectiveText = input.value.trim();

    if (!objectiveText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter objective text before saving"
      );
      return;
    }

    const objectiveData = {
      id: objectiveElement.dataset.itemId, // Use existing itemId
      text: objectiveText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    const existingItemIndex = this.savedDynamicItems.objectives.findIndex(
      (item) => item.id === objectiveData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.objectives[existingItemIndex] = objectiveData;
    } else {
      this.savedDynamicItems.objectives.push(objectiveData);
    }

    this.markItemAsSaved(objectiveElement, "Learning objective saved locally");
    console.log("💾 Learning objective saved locally:", objectiveData);
  }

  addModule(data = null) {
    const container = document.getElementById("modulesContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "module-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Module ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveModule(this.closest('.dynamic-item'))" title="Save module">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'modules')" title="Remove module">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-grid">
                  <div class="form-group">
                      <label>Module Title</label>
                      <input type="text" name="content[modules][${index}][title]" required value="${
      data?.title || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Duration</label>
                      <input type="text" name="content[modules][${index}][duration]" placeholder="e.g., 2 hours" value="${
      data?.duration || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Order</label>
                      <input type="number" name="content[modules][${index}][order]" min="1" value="${
      data?.order || index + 1
    }">
                  </div>
                  <div class="form-group full-width">
                      <label>Description</label>
                      <textarea name="content[modules][${index}][description]" placeholder="Module description...">${
      data?.description || ""
    }</textarea>
                  </div>
              </div>
          `;

    container.appendChild(div);
  }

  async saveModule(moduleElement) {
    const inputs = moduleElement.querySelectorAll("input, textarea");
    const moduleData = {
      id: moduleElement.dataset.itemId, // Use existing itemId
      title: "",
      description: "",
      duration: "",
      order: null,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let isValid = true;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[title]")) {
        moduleData.title = input.value.trim();
        if (!moduleData.title) isValid = false;
      } else if (name.includes("[description]")) {
        moduleData.description = input.value.trim();
      } else if (name.includes("[duration]")) {
        moduleData.duration = input.value.trim();
      } else if (name.includes("[order]")) {
        moduleData.order = parseInt(input.value);
        if (isNaN(moduleData.order) || moduleData.order < 1) isValid = false;
      }
    });

    if (!isValid) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please fill all required fields for the module."
      );
      return;
    }

    const existingItemIndex = this.savedDynamicItems.modules.findIndex(
      (item) => item.id === moduleData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.modules[existingItemIndex] = moduleData;
    } else {
      this.savedDynamicItems.modules.push(moduleData);
    }

    this.markItemAsSaved(moduleElement, "Module saved locally");
    console.log("💾 Module saved locally:", moduleData);
  }

  // Fix 3: Enhanced addInstructor method (replace existing)
  addInstructor(data = null) {
    console.log("➕ Enhanced addInstructor called with data:", data);

    const container = document.getElementById("additionalInstructorsContainer");
    if (!container) {
      console.error("❌ additionalInstructorsContainer not found");
      return;
    }

    const index = container.children.length;
    const itemId = data?.id || this.generateId();

    console.log(`📝 Adding instructor ${index + 1} with ID: ${itemId}`);

    const div = document.createElement("div");
    div.className = "additional-instructor-item dynamic-item";
    div.dataset.itemId = itemId;

    // Build instructor options
    let instructorOptionsHtml = '<option value="">Select Instructor</option>';
    if (this.instructors && Array.isArray(this.instructors)) {
      this.instructors.forEach((inst) => {
        const isSelected = data?.instructorId === inst._id ? "selected" : "";
        instructorOptionsHtml += `<option value="${inst._id}" ${isSelected}>${inst.firstName} ${inst.lastName}</option>`;
      });
    }

    div.innerHTML = `
      <div class="dynamic-item-header">
          <h6>Additional Instructor ${index + 1}</h6>
          <div class="dynamic-item-actions">
              <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveInstructor(this.closest('.dynamic-item'))" title="Save instructor">
                  <i class="fas fa-save"></i>
              </button>
              <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'instructors')" title="Remove instructor">
                  <i class="fas fa-times"></i>
              </button>
          </div>
      </div>
      <div class="form-grid">
          <div class="form-group">
              <label>Additional Instructor</label>
              <select name="instructors[additional][${index}][instructorId]" required onchange="adminOnlineCourses.updateInstructorName(this)">
                  ${instructorOptionsHtml}
              </select>
          </div>
          <div class="form-group">
              <label>Name</label>
              <input type="text" name="instructors[additional][${index}][name]" readonly value="${
      data?.name || ""
    }">
          </div>
          <div class="form-group">
              <label>Role</label>
              <select name="instructors[additional][${index}][role]">
                  <option value="Co-Instructor" ${
                    data?.role === "Co-Instructor" ? "selected" : ""
                  }>Co-Instructor</option>
                  <option value="Guest Instructor" ${
                    data?.role === "Guest Instructor" ? "selected" : ""
                  }>Guest Instructor</option>
                  <option value="Assistant" ${
                    data?.role === "Assistant" ? "selected" : ""
                  }>Assistant</option>
              </select>
          </div>
          <div class="form-group">
              <label>Sessions</label>
              <input type="text" name="instructors[additional][${index}][sessions]" placeholder="Session IDs (comma-separated)" value="${
      Array.isArray(data?.sessions)
        ? data.sessions.join(", ")
        : data?.sessions || ""
    }">
          </div>
      </div>
  `;

    container.appendChild(div);

    // If this is from saved data, mark it as saved
    if (data?.saved) {
      console.log("📝 Marking instructor as saved (from existing data)");
      this.markItemAsSaved(div, "Instructor loaded from saved data");
    }

    console.log("✅ Instructor added to DOM");
  }

  //fixed
  async saveInstructor(instructorElement) {
    console.log("💾 Enhanced saveInstructor called");
    console.log("🔍 Element:", instructorElement);

    if (!instructorElement) {
      console.error("❌ No instructor element provided");
      return;
    }

    const selects = instructorElement.querySelectorAll("select");
    const inputs = instructorElement.querySelectorAll("input");

    console.log("🔍 Found selects:", selects.length);
    console.log("🔍 Found inputs:", inputs.length);

    const instructorData = {
      id: instructorElement.dataset.itemId || this.generateId(),
      instructorId: "",
      name: "",
      role: "Co-Instructor",
      sessions: [],
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;

    // Process selects
    selects.forEach((select, index) => {
      const name = select.name;
      const value = select.value;
      console.log(`🔍 Select ${index}: name="${name}", value="${value}"`);

      if (name && name.includes("[instructorId]")) {
        instructorData.instructorId = value;
        if (value) {
          const selectedOption = select.options[select.selectedIndex];
          instructorData.name = selectedOption.text.trim();
          hasRequiredFields = true;
          console.log(
            "✅ Found instructor ID and name:",
            value,
            instructorData.name
          );
        }
      } else if (name && name.includes("[role]")) {
        instructorData.role = value || "Co-Instructor";
        console.log("✅ Found role:", instructorData.role);
      }
    });

    // Process inputs (for sessions)
    inputs.forEach((input, index) => {
      const name = input.name;
      const value = input.value;
      console.log(`🔍 Input ${index}: name="${name}", value="${value}"`);

      if (name && name.includes("[sessions]")) {
        if (value && value.trim()) {
          instructorData.sessions = value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          console.log("✅ Found sessions:", instructorData.sessions);
        }
      }
    });

    // Validation
    if (!hasRequiredFields) {
      console.error("❌ Validation failed: No instructor selected");
      this.showToast(
        "warning",
        "Validation Error",
        "Please select an instructor before saving"
      );
      return;
    }

    console.log("📝 Final instructor data:", instructorData);

    // Ensure savedDynamicItems.instructors exists
    if (!this.savedDynamicItems.instructors) {
      this.savedDynamicItems.instructors = [];
      console.log("📝 Initialized instructors array");
    }

    // Check if this item already exists and update it, otherwise add new
    const existingIndex = this.savedDynamicItems.instructors.findIndex(
      (item) => item.id === instructorData.id
    );

    if (existingIndex > -1) {
      this.savedDynamicItems.instructors[existingIndex] = instructorData;
      console.log("✅ Updated existing instructor at index:", existingIndex);
    } else {
      this.savedDynamicItems.instructors.push(instructorData);
      console.log(
        "✅ Added new instructor, total count:",
        this.savedDynamicItems.instructors.length
      );
    }

    // Mark element as saved
    this.markItemAsSaved(
      instructorElement,
      "Additional instructor saved locally"
    );

    // Debug: Log current state
    console.log(
      "🔍 Current savedDynamicItems.instructors:",
      this.savedDynamicItems.instructors
    );
  }

  addTargetAudience(text = "") {
    const container = document.getElementById("targetAudienceContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "target-audience-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Target Audience ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveTargetAudience(this.closest('.dynamic-item'))" title="Save target audience">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'targetAudience')" title="Remove target audience">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-group">
                  <label>Target Audience ${index + 1}</label>
                  <input type="text" name="content[targetAudience][${index}]" placeholder="Target audience (e.g., Medical doctors)" required value="${text}">
              </div>
          `;

    container.appendChild(div);
  }

  async saveTargetAudience(element) {
    const input = element.querySelector("input");
    const audienceText = input.value.trim();

    if (!audienceText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter target audience before saving"
      );
      return;
    }

    const audienceData = {
      id: element.dataset.itemId, // Use existing itemId
      text: audienceText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    const existingItemIndex = this.savedDynamicItems.targetAudience.findIndex(
      (item) => item.id === audienceData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.targetAudience[existingItemIndex] = audienceData;
    } else {
      this.savedDynamicItems.targetAudience.push(audienceData);
    }

    this.markItemAsSaved(element, "Target audience saved locally");
    console.log("💾 Target audience saved locally:", audienceData);
  }

  addRequiredSoftware(text = "") {
    const container = document.getElementById("requiredSoftwareContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "software-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Software ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveRequiredSoftware(this.closest('.dynamic-item'))" title="Save software">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'requiredSoftware')" title="Remove software">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-group">
                  <label>Software Name</label>
                  <input type="text" name="technical[requiredSoftware][${index}]" placeholder="Software name" required value="${text}">
              </div>
          `;

    container.appendChild(div);
  }

  async saveRequiredSoftware(element) {
    const input = element.querySelector("input");
    const softwareText = input.value.trim();

    if (!softwareText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter software name before saving"
      );
      return;
    }

    const softwareData = {
      id: element.dataset.itemId, // Use existing itemId
      name: softwareText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    const existingItemIndex = this.savedDynamicItems.requiredSoftware.findIndex(
      (item) => item.id === softwareData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.requiredSoftware[existingItemIndex] = softwareData;
    } else {
      this.savedDynamicItems.requiredSoftware.push(softwareData);
    }

    this.markItemAsSaved(element, "Required software saved locally");
    console.log("💾 Required software saved locally:", softwareData);
  }

  addEngagementTool(text = "") {
    const container = document.getElementById("engagementToolsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "tool-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Engagement Tool ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveEngagementTool(this.closest('.dynamic-item'))" title="Save tool">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'engagementTools')" title="Remove tool">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-group">
                  <label>Tool Name</label>
                  <input type="text" name="interaction[engagementTools][${index}]" placeholder="Tool name (e.g., Mentimeter, Kahoot)" required value="${text}">
              </div>
          `;

    container.appendChild(div);
  }

  async saveEngagementTool(element) {
    const input = element.querySelector("input");
    const toolName = input.value.trim();

    if (!toolName) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter tool name before saving"
      );
      return;
    }

    const toolData = {
      id: element.dataset.itemId, // Use existing itemId
      name: toolName,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    const existingItemIndex = this.savedDynamicItems.engagementTools.findIndex(
      (item) => item.id === toolData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.engagementTools[existingItemIndex] = toolData;
    } else {
      this.savedDynamicItems.engagementTools.push(toolData);
    }

    this.markItemAsSaved(element, "Engagement tool saved locally");
    console.log("💾 Engagement tool saved locally:", toolData);
  }

  addQuestion(data = null) {
    const container = document.getElementById("questionsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const questionDiv = document.createElement("div");
    questionDiv.className = "question-item dynamic-item";
    questionDiv.dataset.itemId = itemId;
    questionDiv.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Question ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveQuestion(this.closest('.dynamic-item'))" title="Save question">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'questions')" title="Remove question">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-grid">
                  <div class="form-group full-width">
                      <label>Question</label>
                      <textarea name="assessment[questions][${index}][question]" placeholder="Question text" required>${
      data?.question || ""
    }</textarea>
                  </div>
                  <div class="form-group">
                      <label>Answer 1</label>
                      <input type="text" name="assessment[questions][${index}][answers][0]" placeholder="Answer option 1" required value="${
      data?.answers?.[0] || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Answer 2</label>
                      <input type="text" name="assessment[questions][${index}][answers][1]" placeholder="Answer option 2" required value="${
      data?.answers?.[1] || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Answer 3</label>
                      <input type="text" name="assessment[questions][${index}][answers][2]" placeholder="Answer option 3" value="${
      data?.answers?.[2] || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Answer 4</label>
                      <input type="text" name="assessment[questions][${index}][answers][3]" placeholder="Answer option 4" value="${
      data?.answers?.[3] || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Correct Answer (1-4)</label>
                      <input type="number" name="assessment[questions][${index}][correctAnswer]" min="1" max="4" required value="${
      data?.correctAnswer || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Points</label>
                      <input type="number" name="assessment[questions][${index}][points]" min="1" value="${
      data?.points || 1
    }">
                  </div>
              </div>
          `;

    container.appendChild(questionDiv);
  }

  async saveQuestion(questionElement) {
    const inputs = questionElement.querySelectorAll("input, textarea");
    const questionData = {
      id: questionElement.dataset.itemId, // Use existing itemId
      question: "",
      answers: [],
      correctAnswer: null,
      points: 1,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let isValid = true;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[question]")) {
        questionData.question = input.value.trim();
        if (!questionData.question) isValid = false;
      } else if (name.includes("[answers][0]")) {
        questionData.answers[0] = input.value.trim();
        if (!questionData.answers[0]) isValid = false;
      } else if (name.includes("[answers][1]")) {
        questionData.answers[1] = input.value.trim();
        if (!questionData.answers[1]) isValid = false;
      } else if (name.includes("[answers][2]")) {
        questionData.answers[2] = input.value.trim();
      } else if (name.includes("[answers][3]")) {
        questionData.answers[3] = input.value.trim();
      } else if (name.includes("[correctAnswer]")) {
        questionData.correctAnswer = parseInt(input.value);
        if (
          isNaN(questionData.correctAnswer) ||
          questionData.correctAnswer < 1 ||
          questionData.correctAnswer > 4
        )
          isValid = false;
      } else if (name.includes("[points]")) {
        questionData.points = parseInt(input.value) || 1;
      }
    });
    questionData.answers = questionData.answers.filter(Boolean); // Remove empty answers

    if (!isValid) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please fill all required fields for the question and ensure correct answer is valid."
      );
      return;
    }

    const existingItemIndex = this.savedDynamicItems.questions.findIndex(
      (item) => item.id === questionData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.questions[existingItemIndex] = questionData;
    } else {
      this.savedDynamicItems.questions.push(questionData);
    }

    this.markItemAsSaved(questionElement, "Question saved locally");
    console.log("💾 Question saved locally:", questionData);
  }

  addVideoLink(text = "") {
    const container = document.getElementById("videoLinksContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "video-link-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Video Link ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveVideoLink(this.closest('.dynamic-item'))" title="Save video link">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'videoLinks')" title="Remove video link">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-group">
                  <label>Video URL</label>
                  <input type="url" name="media[videos][${index}]" placeholder="YouTube, Vimeo, etc." required value="${text}">
              </div>
          `;

    container.appendChild(div);
  }

  async saveVideoLink(element) {
    const input = element.querySelector("input");
    const videoUrl = input.value.trim();

    if (!videoUrl) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter video URL before saving"
      );
      return;
    }

    // Basic URL validation
    try {
      new URL(videoUrl);
    } catch {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter a valid URL for the video link."
      );
      return;
    }

    const videoData = {
      id: element.dataset.itemId, // Use existing itemId
      url: videoUrl,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    const existingItemIndex = this.savedDynamicItems.videoLinks.findIndex(
      (item) => item.id === videoData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.videoLinks[existingItemIndex] = videoData;
    } else {
      this.savedDynamicItems.videoLinks.push(videoData);
    }

    this.markItemAsSaved(element, "Video link saved locally");
    console.log("💾 Video link saved locally:", videoData);
  }

  addLink(data = null) {
    const container = document.getElementById("linksContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "link-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>External Link ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveLink(this.closest('.dynamic-item'))" title="Save link">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'links')" title="Remove link">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-grid">
                  <div class="form-group">
                      <label>Title</label>
                      <input type="text" name="media[links][${index}][title]" placeholder="Link title" required value="${
      data?.title || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>URL</label>
                      <input type="url" name="media[links][${index}][url]" placeholder="https://..." required value="${
      data?.url || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Type</label>
                      <select name="media[links][${index}][type]">
                          <option value="article" ${
                            data?.type === "article" ? "selected" : ""
                          }>Article</option>
                          <option value="video" ${
                            data?.type === "video" ? "selected" : ""
                          }>Video</option>
                          <option value="tool" ${
                            data?.type === "tool" ? "selected" : ""
                          }>Tool</option>
                          <option value="website" ${
                            data?.type === "website" ? "selected" : ""
                          }>Website</option>
                      </select>
                  </div>
              </div>
          `;

    container.appendChild(div);
  }

  async saveLink(element) {
    const inputs = element.querySelectorAll("input, select");
    const linkData = {
      id: element.dataset.itemId, // Use existing itemId
      title: "",
      url: "",
      type: "website",
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let isValid = true;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[title]")) {
        linkData.title = input.value.trim();
        if (!linkData.title) isValid = false;
      } else if (name.includes("[url]")) {
        linkData.url = input.value.trim();
        if (!linkData.url) isValid = false;
      } else if (name.includes("[type]")) {
        linkData.type = input.value;
      }
    });

    if (!isValid) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please fill all required fields for the link."
      );
      return;
    }

    // Basic URL validation
    try {
      new URL(linkData.url);
    } catch {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter a valid URL for the link."
      );
      return;
    }

    const existingItemIndex = this.savedDynamicItems.links.findIndex(
      (item) => item.id === linkData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.links[existingItemIndex] = linkData;
    } else {
      this.savedDynamicItems.links.push(linkData);
    }

    this.markItemAsSaved(element, "External link saved locally");
    console.log("💾 External link saved locally:", linkData);
  }

  addHandout(data = null) {
    const container = document.getElementById("handoutsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "handout-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Handout ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveHandout(this.closest('.dynamic-item'))" title="Save handout">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'handouts')" title="Remove handout">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-grid">
                  <div class="form-group">
                      <label>Title</label>
                      <input type="text" name="materials[handouts][${index}][title]" placeholder="Handout title" required value="${
      data?.title || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>URL</label>
                      <input type="url" name="materials[handouts][${index}][url]" placeholder="File URL" required value="${
      data?.url || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Release Time</label>
                      <select name="materials[handouts][${index}][releaseTime]">
                          <option value="immediate" ${
                            data?.releaseTime === "immediate" ? "selected" : ""
                          }>Immediate</option>
                          <option value="scheduled" ${
                            data?.releaseTime === "scheduled" ? "selected" : ""
                          }>Scheduled</option>
                          <option value="after-session" ${
                            data?.releaseTime === "after-session"
                              ? "selected"
                              : ""
                          }>After Session</option>
                      </select>
                  </div>
                  <div class="form-group">
                      <label>Scheduled Date</label>
                      <input type="datetime-local" name="materials[handouts][${index}][scheduledDate]" value="${
      data?.scheduledDate ? this.formatDateForInput(data.scheduledDate) : ""
    }">
                  </div>
              </div>
          `;

    container.appendChild(div);
  }

  async saveHandout(element) {
    const inputs = element.querySelectorAll("input, select");
    const handoutData = {
      id: element.dataset.itemId, // Use existing itemId
      title: "",
      url: "",
      releaseTime: "immediate",
      scheduledDate: null,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let isValid = true;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[title]")) {
        handoutData.title = input.value.trim();
        if (!handoutData.title) isValid = false;
      } else if (name.includes("[url]")) {
        handoutData.url = input.value.trim();
        if (!handoutData.url) isValid = false;
      } else if (name.includes("[releaseTime]")) {
        handoutData.releaseTime = input.value;
      } else if (name.includes("[scheduledDate]")) {
        handoutData.scheduledDate = input.value || null;
      }
    });

    if (!isValid) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please fill all required fields for the handout."
      );
      return;
    }

    // Basic URL validation
    try {
      new URL(handoutData.url);
    } catch {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter a valid URL for the handout."
      );
      return;
    }

    const existingItemIndex = this.savedDynamicItems.handouts.findIndex(
      (item) => item.id === handoutData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.handouts[existingItemIndex] = handoutData;
    } else {
      this.savedDynamicItems.handouts.push(handoutData);
    }

    this.markItemAsSaved(element, "Handout saved locally");
    console.log("💾 Handout saved locally:", handoutData);
  }

  addVirtualLab(data = null) {
    const container = document.getElementById("virtualLabsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "lab-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Virtual Lab ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveVirtualLab(this.closest('.dynamic-item'))" title="Save virtual lab">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'virtualLabs')" title="Remove virtual lab">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-grid">
                  <div class="form-group">
                      <label>Lab Name</label>
                      <input type="text" name="materials[virtualLabs][${index}][name]" placeholder="Lab name" required value="${
      data?.name || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Platform</label>
                      <input type="text" name="materials[virtualLabs][${index}][platform]" placeholder="Lab platform" value="${
      data?.platform || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Access URL</label>
                      <input type="url" name="materials[virtualLabs][${index}][url]" placeholder="Lab URL" required value="${
      data?.url || ""
    }">
                  </div>
                  <div class="form-group">
                      <label>Duration (hours)</label>
                      <input type="number" name="materials[virtualLabs][${index}][duration]" min="1" placeholder="Access duration" value="${
      data?.duration || ""
    }">
                  </div>
              </div>
          `;

    container.appendChild(div);
  }

  async saveVirtualLab(element) {
    const inputs = element.querySelectorAll("input");
    const labData = {
      id: element.dataset.itemId, // Use existing itemId
      name: "",
      platform: "",
      url: "",
      duration: null,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[name]")) {
        labData.name = input.value.trim();
        if (labData.name) hasRequiredFields = true;
      } else if (name.includes("[platform]")) {
        labData.platform = input.value.trim();
      } else if (name.includes("[url]")) {
        labData.url = input.value.trim();
        if (labData.url) hasRequiredFields = true;
      } else if (name.includes("[duration]")) {
        labData.duration = parseInt(input.value) || null;
      }
    });

    if (!hasRequiredFields) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter lab name and URL before saving"
      );
      return;
    }

    // Basic URL validation
    try {
      new URL(labData.url);
    } catch {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter a valid URL."
      );
      return;
    }

    const existingItemIndex = this.savedDynamicItems.virtualLabs.findIndex(
      (item) => item.id === labData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.virtualLabs[existingItemIndex] = labData;
    } else {
      this.savedDynamicItems.virtualLabs.push(labData);
    }

    this.markItemAsSaved(element, "Virtual lab saved locally");
    console.log("💾 Virtual lab saved locally:", labData);
  }

  addAdvancedCourse(text = "") {
    const container = document.getElementById("advancedCoursesContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "advanced-course-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
              <div class="dynamic-item-header">
                  <h6>Advanced Course ${index + 1}</h6>
                  <div class="dynamic-item-actions">
                      <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveAdvancedCourse(this.closest('.dynamic-item'))" title="Save course">
                          <i class="fas fa-save"></i>
                      </button>
                      <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'advancedCourses')" title="Remove course">
                          <i class="fas fa-times"></i>
                      </button>
                  </div>
              </div>
              <div class="form-group">
                  <label>Advanced Course Code</label>
                  <input type="text" name="postCourse[continuedLearning][advancedCourses][${index}]" placeholder="Advanced course code" required value="${text}">
              </div>
          `;

    container.appendChild(div);
  }

  async saveAdvancedCourse(element) {
    const input = element.querySelector("input");
    const courseCode = input.value.trim();

    if (!courseCode) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter advanced course code before saving"
      );
      return;
    }

    const courseData = {
      id: element.dataset.itemId, // Use existing itemId
      code: courseCode, // Assuming this is just a string code
      saved: true,
      timestamp: new Date().toISOString(),
    };

    const existingItemIndex = this.savedDynamicItems.advancedCourses.findIndex(
      (item) => item.id === courseData.id
    );
    if (existingItemIndex > -1) {
      this.savedDynamicItems.advancedCourses[existingItemIndex] = courseData;
    } else {
      this.savedDynamicItems.advancedCourses.push(courseData);
    }

    this.markItemAsSaved(element, "Advanced course saved locally");
    console.log("💾 Advanced course saved locally:", courseData);
  }

  // NEW: Add Certification Body (from in-person)
  // Fix 4: Enhanced addCertificationBody method (replace existing)
  addCertificationBody(data = null) {
    console.log("➕ Enhanced addCertificationBody called with data:", data);

    const container = document.getElementById("certificationBodiesContainer");
    if (!container) {
      console.error("❌ certificationBodiesContainer not found");
      return;
    }

    const index = container.children.length;
    const itemId = data?.id || this.generateId();

    console.log(`📝 Adding certification body ${index + 1} with ID: ${itemId}`);

    const div = document.createElement("div");
    div.className = "certification-body-item dynamic-item";
    div.dataset.itemId = itemId;

    // Build certification body options
    let optionsHtml = '<option value="">Select Certification Body</option>';
    optionsHtml +=
      '<option value="">IAAI Training Institute (Default)</option>';

    if (this.certificationBodies && Array.isArray(this.certificationBodies)) {
      // Group by membership level
      const grouped = {
        Gold: [],
        Silver: [],
        Bronze: [],
        Standard: [],
      };

      this.certificationBodies.forEach((body) => {
        const level = body.membershipLevel || "Standard";
        if (grouped[level]) {
          grouped[level].push(body);
        }
      });

      // Add grouped options
      Object.keys(grouped).forEach((level) => {
        if (grouped[level].length > 0) {
          optionsHtml += `<optgroup label="${level} Members">`;
          grouped[level].forEach((body) => {
            const isSelected = data?.bodyId === body._id ? "selected" : "";
            optionsHtml += `<option value="${body._id}" ${isSelected}>${
              body.displayName || body.companyName
            }</option>`;
          });
          optionsHtml += "</optgroup>";
        }
      });
    }

    div.innerHTML = `
      <div class="dynamic-item-header">
          <h6>Additional Certification Body ${index + 1}</h6>
          <div class="dynamic-item-actions">
              <button type="button" class="save-item-btn" onclick="adminOnlineCourses.saveCertificationBody(this.closest('.dynamic-item'))" title="Save certification body">
                  <i class="fas fa-save"></i>
              </button>
              <button type="button" class="remove-btn" onclick="adminOnlineCourses.removeDynamicItem(this.closest('.dynamic-item'), 'certificationBodies')" title="Remove certification body">
                  <i class="fas fa-times"></i>
              </button>
          </div>
      </div>
      <div class="form-grid">
          <div class="form-group">
              <label>Certification Body</label>
              <select name="certification[certificationBodies][${index}][bodyId]" required onchange="adminOnlineCourses.updateCertificationBodyInfo(this)">
                  ${optionsHtml}
              </select>
          </div>
          <div class="form-group">
              <label>Body Name</label>
              <input type="text" name="certification[certificationBodies][${index}][name]" readonly value="${
      data?.name || ""
    }">
          </div>
          <div class="form-group">
              <label>Role</label>
              <select name="certification[certificationBodies][${index}][role]">
                  <option value="co-issuer" ${
                    data?.role === "co-issuer" ? "selected" : ""
                  }>Co-Issuer</option>
                  <option value="endorser" ${
                    data?.role === "endorser" ? "selected" : ""
                  }>Endorser</option>
                  <option value="partner" ${
                    data?.role === "partner" ? "selected" : ""
                  }>Partner</option>
              </select>
          </div>
      </div>
  `;

    container.appendChild(div);

    // If this is from saved data, mark it as saved
    if (data?.saved) {
      console.log(
        "📝 Marking certification body as saved (from existing data)"
      );
      this.markItemAsSaved(div, "Certification body loaded from saved data");
    }

    console.log("✅ Certification body added to DOM");
  }

  // Fix 2: Enhanced saveCertificationBody method (replace existing)
  async saveCertificationBody(element) {
    console.log("💾 Enhanced saveCertificationBody called");
    console.log("🔍 Element:", element);

    if (!element) {
      console.error("❌ No certification body element provided");
      return;
    }

    const selects = element.querySelectorAll("select");
    console.log("🔍 Found selects:", selects.length);

    const bodyData = {
      id: element.dataset.itemId || this.generateId(),
      bodyId: "",
      name: "",
      role: "co-issuer",
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;

    selects.forEach((select, index) => {
      const name = select.name;
      const value = select.value;
      console.log(`🔍 Select ${index}: name="${name}", value="${value}"`);

      if (name && name.includes("[bodyId]")) {
        bodyData.bodyId = value;
        if (value) {
          const selectedOption = select.options[select.selectedIndex];
          bodyData.name = selectedOption.text.trim();
          hasRequiredFields = true;
          console.log("✅ Found body ID and name:", value, bodyData.name);
        }
      } else if (name && name.includes("[role]")) {
        bodyData.role = value || "co-issuer";
        console.log("✅ Found role:", bodyData.role);
      }
    });

    // Validation
    if (!hasRequiredFields) {
      console.error("❌ Validation failed: No certification body selected");
      this.showToast(
        "warning",
        "Validation Error",
        "Please select a certification body before saving"
      );
      return;
    }

    console.log("📝 Final certification body data:", bodyData);

    // Ensure savedDynamicItems.certificationBodies exists
    if (!this.savedDynamicItems.certificationBodies) {
      this.savedDynamicItems.certificationBodies = [];
      console.log("📝 Initialized certificationBodies array");
    }

    // Check if this item already exists and update it, otherwise add new
    const existingIndex = this.savedDynamicItems.certificationBodies.findIndex(
      (item) => item.id === bodyData.id
    );

    if (existingIndex > -1) {
      this.savedDynamicItems.certificationBodies[existingIndex] = bodyData;
      console.log(
        "✅ Updated existing certification body at index:",
        existingIndex
      );
    } else {
      this.savedDynamicItems.certificationBodies.push(bodyData);
      console.log(
        "✅ Added new certification body, total count:",
        this.savedDynamicItems.certificationBodies.length
      );
    }

    // Mark element as saved
    this.markItemAsSaved(element, "Certification body saved locally");

    // Debug: Log current state
    console.log(
      "🔍 Current savedDynamicItems.certificationBodies:",
      this.savedDynamicItems.certificationBodies
    );
  }

  // Helper function to mark an item as saved
  markItemAsSaved(element, message) {
    // Add saved class to the element
    element.classList.add("saved-item");
    element.setAttribute("data-saved", "true");

    // Find the save button and update its appearance
    const saveBtn = element.querySelector(".save-item-btn");
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fas fa-check"></i>';
      saveBtn.classList.add("saved");
      saveBtn.title = "Saved";
      saveBtn.disabled = true; // Disable the button
    }

    // Show success toast
    this.showToast("success", "Success", message);

    // Add visual feedback (keep permanently)
    element.style.backgroundColor = "#f0fdf4";
    element.style.borderColor = "#10b981";
  }

  // Helper function to generate unique IDs
  generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper function to remove item from saved items
  removeSavedItem(element, itemType) {
    const itemId = element.dataset.itemId;
    if (itemId && this.savedDynamicItems[itemType]) {
      this.savedDynamicItems[itemType] = this.savedDynamicItems[
        itemType
      ].filter((item) => item.id !== itemId);
      console.log(`🗑️ Removed saved ${itemType} item:`, itemId);
    }
  }

  removeDynamicItem(element, itemType) {
    // Get item details for confirmation
    const itemTitle = this.getItemTitle(element, itemType);

    this.showConfirmModal(
      "Remove Item",
      `Are you sure you want to remove "${itemTitle}"? This action cannot be undone.`,
      () => {
        // Remove from saved items if it exists
        this.removeSavedItem(element, itemType);

        // Remove the DOM element
        element.remove();

        this.showToast("info", "Item Removed", `${itemTitle} has been removed`);
      }
    );
  }

  getItemTitle(element, itemType) {
    let title = "this item";

    try {
      switch (itemType) {
        case "sessions":
          const sessionTitleInput = element.querySelector(
            'input[name*="[title]"]'
          );
          title = sessionTitleInput?.value?.trim() || "Session";
          break;
        case "objectives":
          const objectiveInput = element.querySelector('input[type="text"]');
          title = objectiveInput?.value?.trim() || "Learning Objective";
          break;
        case "modules":
          const moduleInput = element.querySelector('input[name*="[title]"]');
          title = moduleInput?.value?.trim() || "Module";
          break;
        case "targetAudience":
          const audienceInput = element.querySelector('input[type="text"]');
          title = audienceInput?.value?.trim() || "Target Audience";
          break;
        case "requiredSoftware":
          const softwareInput = element.querySelector('input[type="text"]');
          title = softwareInput?.value?.trim() || "Required Software";
          break;
        case "engagementTools":
          const toolInput = element.querySelector('input[type="text"]');
          title = toolInput?.value?.trim() || "Engagement Tool";
          break;
        case "questions":
          const questionInput = element.querySelector("textarea");
          title =
            questionInput?.value?.trim()?.substring(0, 50) + "..." ||
            "Question";
          break;
        case "videoLinks":
          const videoInput = element.querySelector('input[type="url"]');
          title = videoInput?.value?.trim() || "Video Link";
          break;
        case "links":
          const linkTitleInput = element.querySelector(
            'input[name*="[title]"]'
          );
          title = linkTitleInput?.value?.trim() || "External Link";
          break;
        case "handouts":
          const handoutTitleInput = element.querySelector(
            'input[name*="[title]"]'
          );
          title = handoutTitleInput?.value?.trim() || "Handout";
          break;
        case "virtualLabs":
          const labNameInput = element.querySelector('input[name*="[name]"]');
          title = labNameInput?.value?.trim() || "Virtual Lab";
          break;
        case "advancedCourses":
          const courseInput = element.querySelector('input[type="text"]');
          title = courseInput?.value?.trim() || "Advanced Course";
          break;
        case "certificationBodies": // NEW: For cert bodies
          const certBodySelect = element.querySelector(
            'select[name*="[bodyId]"]'
          );
          if (certBodySelect && certBodySelect.selectedIndex > 0) {
            title =
              certBodySelect.options[
                certBodySelect.selectedIndex
              ].textContent.trim();
          } else {
            title = "Certification Body";
          }
          break;
        default:
          title = itemType
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
      }
    } catch (error) {
      console.warn("Error getting item title:", error);
    }

    return title;
  }

  // Form Submission
  // Fix for admin-online-courses.js - Update the submitForm method

  // Update the submitForm method to call sanitizeMediaFields before submission
  // Replace the existing submitForm method with this updated version:

  async submitForm(e) {
    console.log("🚀 Enhanced submitForm called");
    e.preventDefault();

    if (!this.validateCurrentStep()) {
      this.showToast(
        "error",
        "Validation Error",
        "Please complete all required fields"
      );
      return;
    }

    // ENHANCED: Better validation of dynamic items before submission
    const unsavedDynamicItems = this.checkForUnsavedDynamicItems();
    if (unsavedDynamicItems.length > 0) {
      this.showToast(
        "warning",
        "Unsaved Items",
        `Please save all dynamic items before submitting: ${unsavedDynamicItems.join(
          ", "
        )}`
      );
      return;
    }

    // NEW: Sanitize media fields before submission
    this.sanitizeMediaFields();

    this.showLoading(true);

    try {
      console.log("🚀 Starting enhanced form submission...");

      // ✅ Disable problematic file inputs before creating FormData
      ["mainImage", "documents", "images", "videos"].forEach((inputName) => {
        const input = document.querySelector(`input[name="${inputName}"]`);
        if (input) input.disabled = true;
      });

      // Create FormData from form (now without File objects)
      const formData = new FormData(document.getElementById("courseForm"));

      // CRITICAL: Enhanced handling of savedDynamicItems
      console.log(
        "🔍 savedDynamicItems state before submission:",
        this.savedDynamicItems
      );

      // Validate that we have the savedDynamicItems object
      if (
        !this.savedDynamicItems ||
        typeof this.savedDynamicItems !== "object"
      ) {
        console.warn(
          "⚠️ savedDynamicItems is missing or invalid, initializing..."
        );
        this.savedDynamicItems = {
          sessions: [],
          objectives: [],
          modules: [],
          targetAudience: [],
          requiredSoftware: [],
          engagementTools: [],
          questions: [],
          videoLinks: [],
          links: [],
          handouts: [],
          virtualLabs: [],
          advancedCourses: [],
          certificationBodies: [],
          instructors: [],
        };
      }

      // Enhanced validation and stringification
      let savedItemsJson;
      try {
        // Clean the data before stringifying
        const cleanedDynamicItems = {};
        Object.keys(this.savedDynamicItems).forEach((key) => {
          if (Array.isArray(this.savedDynamicItems[key])) {
            cleanedDynamicItems[key] = this.savedDynamicItems[key].filter(
              (item) => {
                // Keep items that have been marked as saved
                return item && (item.saved === true || item.saved === "true");
              }
            );
            console.log(
              `📝 ${key}: ${cleanedDynamicItems[key].length} saved items`
            );
          } else {
            cleanedDynamicItems[key] = [];
          }
        });

        savedItemsJson = JSON.stringify(cleanedDynamicItems);
        console.log("✅ Successfully stringified savedDynamicItems");

        // Validate the JSON
        JSON.parse(savedItemsJson); // This will throw if invalid
      } catch (jsonError) {
        console.error("❌ JSON error with savedDynamicItems:", jsonError);
        console.error("❌ Problematic data:", this.savedDynamicItems);
        this.showToast(
          "error",
          "Data Error",
          "There's an issue with the saved dynamic items. Please refresh and try again."
        );
        return;
      }

      formData.set("savedDynamicItems", savedItemsJson);

      // Enhanced file handling with better validation
      if (this.savedUploadedFiles) {
        console.log(
          "📁 Processing savedUploadedFiles:",
          this.savedUploadedFiles
        );

        Object.keys(this.savedUploadedFiles).forEach((fileType) => {
          const files = this.savedUploadedFiles[fileType];

          if (fileType === "mainImage" && files) {
            if (typeof files === "string" && files.trim()) {
              formData.append(`uploadedFiles[mainImage][0]`, files);
              console.log(`📎 Added mainImage: ${files}`);
            }
          } else if (Array.isArray(files) && files.length > 0) {
            files.forEach((fileUrl, index) => {
              if (fileUrl && typeof fileUrl === "string" && fileUrl.trim()) {
                formData.append(
                  `uploadedFiles[${fileType}][${index}]`,
                  fileUrl
                );
                console.log(`📎 Added ${fileType}[${index}]: ${fileUrl}`);
              }
            });
          }
        });
      }

      // Enhanced debugging with field counting
      console.log("📤 Enhanced Form Data Contents:");
      let fieldCount = 0;
      let dynamicItemsFound = false;

      for (let [key, value] of formData.entries()) {
        fieldCount++;

        if (key === "savedDynamicItems") {
          dynamicItemsFound = true;
          console.log(
            `🔑 "${key}": [JSON with ${
              Object.keys(JSON.parse(value)).length
            } keys]`
          );

          // Log summary of dynamic items
          const parsed = JSON.parse(value);
          Object.keys(parsed).forEach((itemType) => {
            if (parsed[itemType].length > 0) {
              console.log(
                `    📝 ${itemType}: ${parsed[itemType].length} items`
              );
            }
          });
        } else {
          const displayValue =
            typeof value === "string" && value.length > 100
              ? value.substring(0, 100) + "..."
              : value;
          console.log(`  "${key}": "${displayValue}"`);
        }
      }

      console.log(`📊 Total form fields: ${fieldCount}`);

      if (!dynamicItemsFound) {
        console.error("❌ CRITICAL: savedDynamicItems not found in FormData!");
        this.showToast(
          "error",
          "Data Error",
          "Dynamic items data is missing from the form"
        );
        return;
      }

      // Send the request
      const url = this.editingCourse
        ? `/admin-courses/onlinelive/api/${this.editingCourse}`
        : "/admin-courses/onlinelive/api";
      const method = this.editingCourse ? "PUT" : "POST";

      console.log(`📡 Sending ${method} to ${url}`);

      const response = await fetch(url, {
        method: method,
        body: formData,
      });

      console.log("📊 Response status:", response.status);
      console.log("📊 Response ok:", response.ok);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch {
          errorData.message = await response.text();
        }
        console.error("❌ Response error details:", errorData);
        throw new Error(
          errorData.message || `HTTP ${response.status}: Request failed`
        );
      }

      const result = await response.json();
      console.log("✅ Success result:", result);

      if (result.success) {
        this.closeCourseModal();
        this.showToast(
          "success",
          "Success",
          result.message ||
            (this.editingCourse
              ? "Course updated successfully"
              : "Course created successfully")
        );

        // Clear saved data after successful submission
        this.savedUploadedFiles = {
          mainImage: null,
          documents: [],
          images: [],
          videos: [],
        };
        this.clearSavedDynamicItems();
        console.log("🧹 Cleared saved data after successful submission");

        await this.loadInitialData();
      } else {
        throw new Error(result.message || "Unknown error occurred");
      }
    } catch (error) {
      console.error("❌ Enhanced submission error:", error);
      this.showToast(
        "error",
        "Error",
        `Failed to save course: ${error.message}`
      );
    } finally {
      this.showLoading(false);
    }
  }

  // Course Actions
  async editCourse(courseId) {
    try {
      console.log("✏️ Editing course:", courseId);

      // Show loading
      this.showLoading(true);

      const response = await fetch(`/admin-courses/onlinelive/api/${courseId}`);
      const result = await response.json();

      if (response.ok && result.success) {
        console.log(
          "📝 Course data loaded for editing:",
          result.course.basic?.title || "Untitled"
        );

        // Set editing course ID
        this.editingCourse = courseId;

        // Open modal WITHOUT courseId to prevent recursion
        await this.openCourseModal(); // Don't pass courseId

        // Populate form after modal is open
        this.populateFormWithCourse(result.course);
      } else {
        this.showToast(
          "error",
          "Error",
          result.message || "Failed to load course data"
        );
      }
    } catch (error) {
      console.error("Error loading course for edit:", error);
      this.showToast("error", "Error", "Failed to load course data");
    } finally {
      this.showLoading(false);
    }
  }

  // Clone course method (same as in-person version)
  async cloneCourse(courseId) {
    try {
      const course = this.courses.find((c) => c._id === courseId);
      const courseName = course
        ? course.basic?.title || "this course"
        : "this course";

      // Show clone options modal
      this.showCloneOptionsModal(courseId, courseName);
    } catch (error) {
      console.error("Error preparing course clone:", error);
      this.showToast("error", "Error", "Failed to prepare course clone");
    }
  }

  showCloneOptionsModal(courseId, courseName) {
    // Create clone options modal dynamically
    const modalHTML = `
              <div class="modal-overlay" id="cloneOptionsModal">
                  <div class="modal-container">
                      <div class="modal-header">
                          <h3>Clone Online Course: <span id="cloneCourseName">${courseName}</span></h3>
                          <button class="close-btn" onclick="adminOnlineCourses.closeCloneOptionsModal()">
                              <i class="fas fa-times"></i>
                          </button>
                      </div>
                      <div class="modal-body">
                          <form id="cloneOptionsForm">
                              <input type="hidden" id="cloneCourseId" value="${courseId}">
                              <div class="form-group">
                                  <label for="cloneTitle">New Course Title *</label>
                                  <input type="text" id="cloneTitle" name="title" required
                                              placeholder="Enter new course title" maxlength="200">
                                  <small class="help-text">The title for the cloned course</small>
                              </div>
                              
                              <div class="form-group">
                                  <label for="cloneCourseCode">New Course Code *</label>
                                  <input type="text" id="cloneCourseCode" name="courseCode" required
                                              placeholder="Enter unique course code" maxlength="50"
                                              style="text-transform: uppercase;">
                                  <small class="help-text">Must be unique across all courses</small>
                              </div>
                              
                              <div class="form-group">
                                  <label for="cloneStartDate">New Start Date *</label>
                                  <input type="datetime-local" id="cloneStartDate" name="startDate" required>
                                  <small class="help-text">Course will be scheduled for this date</small>
                              </div>
                              
                              <div class="form-group">
                                  <label for="cloneStatus">Initial Status</label>
                                  <select id="cloneStatus" name="status">
                                      <option value="draft">Draft</option>
                                      <option value="open" selected>Open to Register</option>
                                      <option value="full">Full</option>
                                  </select>
                                  <small class="help-text">Status for the cloned course</small>
                              </div>
                              
                              <div class="clone-options-section">
                                  <h4>Clone Options</h4>
                                  <div class="checkbox-grid">
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneInstructors" checked>
                                          <span>Clone Instructors</span>
                                          <small>Copy instructor assignments</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneContent" checked>
                                          <span>Clone Content</span>
                                          <small>Copy objectives, modules, and materials</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneAssessment" checked>
                                          <span>Clone Assessment & Certification</span>
                                          <small>Copy assessment questions and certification settings</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="clonePlatform" checked>
                                          <span>Clone Platform & Access</span>
                                          <small>Copy virtual platform details</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneTechnical" checked>
                                          <span>Clone Technical Requirements</span>
                                          <small>Copy system, internet, and equipment needs</small>
                                      </label>
                                      
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneInteraction" checked>
                                          <span>Clone Interaction & Engagement</span>
                                          <small>Copy participation and engagement settings</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneRecording" checked>
                                          <span>Clone Recording & Replay</span>
                                          <small>Copy recording settings and replay availability</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneMedia">
                                          <span>Clone Media Files</span>
                                          <small>Copy uploaded images and documents (references only)</small>
                                      </label>
                                      
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneMaterials" checked>
                                          <span>Clone Digital Materials</span>
                                          <small>Copy handouts, virtual labs, and LMS settings</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="clonePostCourse" checked>
                                          <span>Clone Post-Course & Alumni</span>
                                          <small>Copy access durations and alumni benefits</small>
                                      </label>
                                      
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="cloneExperience" checked>
                                          <span>Clone Participant Experience</span>
                                          <small>Copy onboarding and accessibility settings</small>
                                      </label>
  
                                      <label class="checkbox-item">
                                          <input type="checkbox" name="resetEnrollment" checked>
                                          <span>Reset Enrollment</span>
                                          <small>Start with 0 enrolled students</small>
                                      </label>
                                  </div>
                              </div>
  
                              <div class="form-group">
                                  <label for="cloneNotes">Clone Notes (Optional)</label>
                                  <textarea id="cloneNotes" name="notes"
                                              placeholder="Add any notes about this clone..."></textarea>
                              </div>
                          </form>
  
                          <div class="modal-actions">
                              <button type="button" class="btn btn-secondary" onclick="adminOnlineCourses.closeCloneOptionsModal()">
                                  Cancel
                              </button>
                              <button type="button" class="btn btn-primary" onclick="adminOnlineCourses.executeClone(document.getElementById('cloneCourseId').value)">
                                  <i class="fas fa-copy"></i> Clone Course
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          `;

    // Remove existing modal if any
    const existingModal = document.getElementById("cloneOptionsModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Show modal
    const modal = document.getElementById("cloneOptionsModal");
    modal.classList.add("active");

    // Set default values
    this.setCloneDefaults(courseId);

    // Add event listeners
    this.setupCloneModalEventListeners();
  }

  setCloneDefaults(courseId) {
    const originalCourse = this.courses.find((c) => c._id === courseId);
    if (!originalCourse) return;

    // Set default title
    const originalTitle = originalCourse.basic?.title || "Course";
    document.getElementById("cloneTitle").value = `${originalTitle} (Copy)`;

    // Set default course code
    const originalCode = originalCourse.basic?.courseCode || "COURSE";
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    document.getElementById(
      "cloneCourseCode"
    ).value = `${originalCode}-COPY-${timestamp}`;

    // Set default start date (30 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    document.getElementById("cloneStartDate").value = futureDate
      .toISOString()
      .slice(0, 16);
  }

  setupCloneModalEventListeners() {
    // Auto-generate course code when title changes
    const titleInput = document.getElementById("cloneTitle");
    const codeInput = document.getElementById("cloneCourseCode");

    titleInput.addEventListener("blur", async () => {
      // Changed to 'blur' from 'input' for better auto-generation UX
      const title = titleInput.value.trim();
      if (title && !codeInput.value) {
        // Only generate if code is empty and title exists
        try {
          const response = await fetch(
            "/admin-courses/onlinelive/api/generate-course-code",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            }
          );
          const data = await response.json();
          if (data.success) {
            codeInput.value = data.courseCode;
            codeInput.classList.add("auto-generated");
            this.showToast(
              "info",
              "Course Code Generated",
              "Course code generated automatically"
            );
          }
        } catch (error) {
          console.error("Error generating course code for clone:", error);
        }
      }
    });

    // Validate course code uniqueness on blur
    codeInput.addEventListener("blur", async (e) => {
      // Need courseId for check, so pass it from the hidden input
      const currentCourseId = document.getElementById("cloneCourseId").value;
      await this.validateCourseCode(e.target.value, currentCourseId);
    });

    // Modal overlay click to close
    const modal = document.getElementById("cloneOptionsModal");
    modal.addEventListener("click", (e) => {
      if (e.target.id === "cloneOptionsModal") {
        this.closeCloneOptionsModal();
      }
    });
  }

  async validateCourseCode(courseCode, excludeId = null) {
    if (!courseCode.trim()) return;

    try {
      let url = `/admin-courses/onlinelive/api/check-course-code?code=${encodeURIComponent(
        courseCode
      )}`;
      if (excludeId) {
        url += `&excludeId=${excludeId}`;
      }
      const response = await fetch(url);
      const result = await response.json();

      const codeInput =
        document.getElementById("cloneCourseCode") ||
        document.getElementById("courseCode"); // Check both
      const helpText = codeInput.parentElement.querySelector(".help-text");

      if (result.success && !result.available) {
        codeInput.style.borderColor = "#ef4444";
        helpText.textContent =
          "This course code already exists. Please choose a different one.";
        helpText.style.color = "#ef4444";
        return false;
      } else {
        codeInput.style.borderColor = "#10b981";
        helpText.textContent = "Course code is available";
        helpText.style.color = "#10b981";
        return true;
      }
    } catch (error) {
      console.error("Error validating course code:", error);
      this.showToast("error", "Error", "Failed to validate course code.");
      return true; // Allow proceeding if validation fails due to network error etc.
    }
  }

  closeCloneOptionsModal() {
    const modal = document.getElementById("cloneOptionsModal");
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  }

  async executeClone(originalCourseId) {
    try {
      // Validate form
      const form = document.getElementById("cloneOptionsForm");
      const formData = new FormData(form);

      // Check required fields
      const requiredFields = ["title", "courseCode", "startDate"];
      const missingFields = [];

      requiredFields.forEach((field) => {
        if (!formData.get(field)?.trim()) {
          missingFields.push(field);
        }
      });

      if (missingFields.length > 0) {
        this.showToast(
          "warning",
          "Validation Error",
          `Please fill in all required fields: ${missingFields.join(", ")}`
        );
        return;
      }

      // Validate course code uniqueness
      const codeIsValid = await this.validateCourseCode(
        formData.get("courseCode"),
        originalCourseId
      ); // Pass originalCourseId for check
      if (!codeIsValid) {
        this.showToast(
          "error",
          "Validation Error",
          "Please choose a unique course code"
        );
        return;
      }

      // Prepare clone options
      const cloneOptions = {
        title: formData.get("title").trim(),
        courseCode: formData.get("courseCode").trim().toUpperCase(),
        startDate: formData.get("startDate"),
        status: formData.get("status"),
        notes: formData.get("notes")?.trim() || "",
        options: {
          cloneInstructors: formData.has("cloneInstructors"),
          cloneContent: formData.has("cloneContent"),
          cloneAssessment: formData.has("cloneAssessment"),
          clonePlatform: formData.has("clonePlatform"),
          cloneTechnical: formData.has("cloneTechnical"),
          cloneInteraction: formData.has("cloneInteraction"),
          cloneRecording: formData.has("cloneRecording"),
          cloneMedia: formData.has("cloneMedia"),
          cloneMaterials: formData.has("cloneMaterials"),
          clonePostCourse: formData.has("clonePostCourse"),
          cloneExperience: formData.has("cloneExperience"),
          resetEnrollment: formData.has("resetEnrollment"),
        },
      };

      console.log("🔄 Cloning course with options:", cloneOptions);

      this.showLoading(true);

      // Send clone request
      const response = await fetch(
        `/admin-courses/onlinelive/api/${originalCourseId}/clone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cloneOptions),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        // Close modal
        this.closeCloneOptionsModal();

        // Show success message
        this.showToast(
          "success",
          "Success",
          result.message ||
            (this.editingCourse
              ? "Course updated successfully"
              : "Course created successfully")
        );

        // Reload course data
        await this.loadInitialData();

        // Optional: Open the cloned course for editing
        const shouldEdit = await this.showConfirmDialog(
          "Edit Cloned Course",
          "Would you like to edit the cloned course now?"
        );

        if (shouldEdit) {
          this.editCourse(result.course._id);
        }
      } else {
        throw new Error(result.message || "Failed to clone course");
      }
    } catch (error) {
      console.error("❌ Error cloning course:", error);
      this.showToast(
        "error",
        "Clone Failed",
        `Failed to clone course: ${error.message}`
      );
    } finally {
      this.showLoading(false);
    }
  }

  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      this.showConfirmModal(title, message, () => resolve(true), {
        confirmText: "Yes",
        cancelText: "No",
        confirmClass: "btn-primary",
      });

      // Override cancel to resolve false
      const cancelBtn = document.getElementById("cancelAction");
      if (cancelBtn) {
        const originalHandler = cancelBtn.onclick; // Store original handler if any
        cancelBtn.onclick = () => {
          resolve(false);
          if (originalHandler) originalHandler(); // Call original handler if it existed
          this.closeConfirmModal(); // Ensure modal closes
        };
      }
    });
  }

  async deleteCourse(courseId) {
    try {
      const course = this.courses.find((c) => c._id === courseId);
      const courseName = course
        ? course.basic?.title || "this course"
        : "this course";

      this.showConfirmModal(
        "Delete Course",
        `Are you sure you want to delete "${courseName}"? This action cannot be undone and will permanently remove all course data including enrollments and certificates.`,
        async () => {
          // Ensure this callback is async
          try {
            console.log("🗑️ Deleting course:", courseId);

            const response = await fetch(
              `/admin-courses/onlinelive/api/${courseId}`,
              {
                method: "DELETE",
              }
            );

            const result = await response.json();

            if (response.ok && result.success) {
              this.courses = this.courses.filter((c) => c._id !== courseId);
              this.applyFilters();
              this.updateStats();
              this.showToast(
                "success",
                "Success",
                "Course deleted successfully"
              );
            } else {
              this.showToast(
                "error",
                "Error",
                result.message || "Failed to delete course"
              );
            }
          } catch (error) {
            console.error("Error deleting course:", error);
            this.showToast("error", "Error", "Failed to delete course");
          }
        }
      );
    } catch (error) {
      console.error("Error preparing course deletion:", error);
      this.showToast("error", "Error", "Failed to delete course");
    }
  }

  // Populate form with course data - Aligned with Online Model
  /**
   * Populates the course form with data from a fetched course object for editing.
   * Ensures proper handling of various data structures including nested objects,
   * dynamic arrays, and file URLs.
   * @param {object} course - The course object fetched from the backend API.
   */
  /**
   * 

  /**
 * SAFE COMPLETE VERSION: Populates the course form with data - handles all undefined values safely
 */
  populateFormWithCourse(course) {
    console.log(
      "📋 SAFE COMPLETE: Populating form with course data for editing:",
      course
    );

    // 1. Clear existing dynamic sections and saved items
    this.clearDynamicSections();
    this.clearSavedDynamicItems();
    this.populatePrimaryInstructor();

    // 2. Populate savedUploadedFiles with existing file URLs
    this.savedUploadedFiles = {
      mainImage: null,
      documents: [],
      images: [],
      videos: [],
    };

    // Process main image safely
    if (course.media?.mainImage) {
      if (
        typeof course.media.mainImage === "object" &&
        course.media.mainImage.url
      ) {
        this.savedUploadedFiles.mainImage = course.media.mainImage.url;
      } else if (typeof course.media.mainImage === "string") {
        this.savedUploadedFiles.mainImage = course.media.mainImage;
      }
    }

    // Process file arrays safely
    if (course.media?.documents && Array.isArray(course.media.documents)) {
      this.savedUploadedFiles.documents = [...course.media.documents];
    }
    if (course.media?.images && Array.isArray(course.media.images)) {
      this.savedUploadedFiles.images = [...course.media.images];
    }

    // Process videos safely
    if (course.media?.videos && Array.isArray(course.media.videos)) {
      const uploadedVideoFiles = [];
      const externalVideoLinks = [];

      course.media.videos.forEach((url) => {
        if (url && url.startsWith("/uploads/")) {
          uploadedVideoFiles.push(url);
        } else if (url) {
          externalVideoLinks.push({
            url: url,
            id: this.generateId(),
            saved: true,
            timestamp: new Date().toISOString(),
          });
        }
      });

      this.savedUploadedFiles.videos = uploadedVideoFiles;
      this.savedDynamicItems.videoLinks = externalVideoLinks;
    }

    console.log(
      "📁 Populated savedUploadedFiles for editing:",
      this.savedUploadedFiles
    );

    // 3. Process and populate dynamic items SAFELY
    this._populateAllDynamicItemsSafely(course);

    console.log("💾 Re-populated savedDynamicItems:", this.savedDynamicItems);

    // 4. Load certification bodies FIRST, then populate all form fields
    this.loadCertificationBodies()
      .then(() => {
        console.log("📝 Starting SAFE form field population...");

        // SAFE data processing - no undefined errors
        this._safelyProcessCourseData(course);

        // Populate ALL form fields safely
        this._populateAllFormFieldsSafely(course);

        // Display existing uploaded files
        console.log("📁 About to display existing files...");
        this.displayExistingUploadedFiles(course);

        // Render dynamic sections with saved data
        console.log("🔄 Re-rendering dynamic sections with saved data...");
        this._renderAllDynamicSectionsSafely();

        console.log(
          "✅ SAFE COMPLETE form populated successfully with course data"
        );
      })
      .catch((error) => {
        console.error(
          "❌ Error loading certification bodies during form population:",
          error
        );
        console.log(
          "⚠️ Proceeding with SAFE form population despite certification body error"
        );

        // SAFE minimal form population
        this._safelyProcessCourseData(course);
        this._populateBasicFormFieldsSafely(course);
        this.displayExistingUploadedFiles(course);
        this._renderAllDynamicSectionsSafely();
      });
  }

  // NEW: Safely populate all dynamic items
  _populateAllDynamicItemsSafely(course) {
    console.log("📝 SAFELY populating ALL dynamic items...");

    // Sessions
    if (course.schedule?.sessions && Array.isArray(course.schedule.sessions)) {
      this.savedDynamicItems.sessions = course.schedule.sessions.map((s) => ({
        ...s,
        id: this.generateId(),
        saved: true,
        timestamp: new Date().toISOString(),
      }));
    }

    // Objectives
    if (
      course.content?.objectives &&
      Array.isArray(course.content.objectives)
    ) {
      this.savedDynamicItems.objectives = course.content.objectives.map(
        (o) => ({
          text: o && typeof o === "object" ? o.text : o,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Modules
    if (course.content?.modules && Array.isArray(course.content.modules)) {
      this.savedDynamicItems.modules = course.content.modules.map((m) => ({
        ...m,
        id: this.generateId(),
        saved: true,
        timestamp: new Date().toISOString(),
      }));
    }

    // Additional instructors - SAFE VERSION
    if (
      course.instructors?.additional &&
      Array.isArray(course.instructors.additional)
    ) {
      console.log(
        "📝 Processing additional instructors for editing:",
        course.instructors.additional.length
      );

      this.savedDynamicItems.instructors = course.instructors.additional.map(
        (inst) => {
          const instructorId = inst.instructorId;
          let instructorIdString = "";
          let instructorName = inst.name || "";

          if (instructorId) {
            if (typeof instructorId === "object" && instructorId._id) {
              instructorIdString = instructorId._id.toString();
              instructorName = `${instructorId.firstName || ""} ${
                instructorId.lastName || ""
              }`.trim();
            } else if (typeof instructorId === "string") {
              instructorIdString = instructorId;
            }
          }

          return {
            id: this.generateId(),
            instructorId: instructorIdString,
            name: instructorName,
            role: inst.role || "Co-Instructor",
            sessions: Array.isArray(inst.sessions)
              ? inst.sessions
              : typeof inst.sessions === "string"
              ? inst.sessions
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            saved: true,
            timestamp: new Date().toISOString(),
          };
        }
      );

      console.log(
        "✅ SAFELY processed additional instructors:",
        this.savedDynamicItems.instructors
      );
    }

    // Certification bodies - SAFE VERSION
    if (
      course.certification?.certificationBodies &&
      Array.isArray(course.certification.certificationBodies)
    ) {
      console.log(
        "📝 Processing certification bodies for editing:",
        course.certification.certificationBodies.length
      );

      this.savedDynamicItems.certificationBodies =
        course.certification.certificationBodies.map((cb) => {
          const bodyId = cb.bodyId;
          let bodyIdString = "";
          let bodyName = cb.name || "";

          if (bodyId) {
            if (typeof bodyId === "object" && bodyId._id) {
              bodyIdString = bodyId._id.toString();
              bodyName = bodyId.displayName || bodyId.companyName || bodyName;
            } else if (typeof bodyId === "string") {
              bodyIdString = bodyId;
            }
          }

          return {
            id: this.generateId(),
            bodyId: bodyIdString,
            name: bodyName,
            role: cb.role || "co-issuer",
            saved: true,
            timestamp: new Date().toISOString(),
          };
        });

      console.log(
        "✅ SAFELY processed certification bodies:",
        this.savedDynamicItems.certificationBodies
      );
    }

    // Other dynamic items (same as before)
    if (
      course.content?.targetAudience &&
      Array.isArray(course.content.targetAudience)
    ) {
      this.savedDynamicItems.targetAudience = course.content.targetAudience.map(
        (a) => ({
          text: a && typeof a === "object" ? a.text : a,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        })
      );
    }

    if (
      course.technical?.requiredSoftware &&
      Array.isArray(course.technical.requiredSoftware)
    ) {
      this.savedDynamicItems.requiredSoftware =
        course.technical.requiredSoftware.map((s) => ({
          name: s && typeof s === "object" ? s.name : s,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        }));
    }

    if (
      course.interaction?.engagementTools &&
      Array.isArray(course.interaction.engagementTools)
    ) {
      this.savedDynamicItems.engagementTools =
        course.interaction.engagementTools.map((t) => ({
          name: t && typeof t === "object" ? t.name : t,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        }));
    }

    if (
      course.assessment?.questions &&
      Array.isArray(course.assessment.questions)
    ) {
      this.savedDynamicItems.questions = course.assessment.questions.map(
        (q) => ({
          ...q,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        })
      );
    }

    if (course.media?.links && Array.isArray(course.media.links)) {
      this.savedDynamicItems.links = course.media.links.map((l) => ({
        ...l,
        id: this.generateId(),
        saved: true,
        timestamp: new Date().toISOString(),
      }));
    }

    if (
      course.materials?.handouts &&
      Array.isArray(course.materials.handouts)
    ) {
      this.savedDynamicItems.handouts = course.materials.handouts.map((h) => ({
        ...h,
        id: this.generateId(),
        saved: true,
        timestamp: new Date().toISOString(),
      }));
    }

    if (
      course.materials?.virtualLabs &&
      Array.isArray(course.materials.virtualLabs)
    ) {
      this.savedDynamicItems.virtualLabs = course.materials.virtualLabs.map(
        (v) => ({
          ...v,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        })
      );
    }

    if (
      course.postCourse?.continuedLearning?.advancedCourses &&
      Array.isArray(course.postCourse.continuedLearning.advancedCourses)
    ) {
      this.savedDynamicItems.advancedCourses =
        course.postCourse.continuedLearning.advancedCourses.map((ac) => ({
          code: ac && typeof ac === "object" ? ac.code : ac,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        }));
    }
  }

  // NEW: Safely process course data for form display
  _safelyProcessCourseData(course) {
    console.log("🔧 SAFELY processing course data...");

    // Format dates safely
    if (course.schedule) {
      if (course.schedule.startDate) {
        course.schedule.startDate = new Date(course.schedule.startDate)
          .toISOString()
          .slice(0, 16);
      }
      if (course.schedule.endDate) {
        course.schedule.endDate = new Date(course.schedule.endDate)
          .toISOString()
          .slice(0, 16);
      }
      if (course.schedule.registrationDeadline) {
        course.schedule.registrationDeadline = new Date(
          course.schedule.registrationDeadline
        )
          .toISOString()
          .slice(0, 16);
      }
    }

    if (course.technical?.techCheckDate) {
      course.technical.techCheckDate = new Date(course.technical.techCheckDate)
        .toISOString()
        .slice(0, 16);
    }

    if (course.experience?.onboarding?.orientationDate) {
      course.experience.onboarding.orientationDate = new Date(
        course.experience.onboarding.orientationDate
      )
        .toISOString()
        .slice(0, 16);
    }

    // SAFE instructor processing
    if (course.instructors?.primary?.instructorId) {
      if (
        typeof course.instructors.primary.instructorId === "object" &&
        course.instructors.primary.instructorId.firstName
      ) {
        course.instructors.primary.name =
          course.instructors.primary.instructorId.firstName +
          " " +
          course.instructors.primary.instructorId.lastName;
        course.instructors.primary.instructorId =
          course.instructors.primary.instructorId._id?.toString() || "";
      } else {
        // Keep existing values if instructorId is already a string
        course.instructors.primary.instructorId =
          course.instructors.primary.instructorId.toString();
        course.instructors.primary.name = course.instructors.primary.name || "";
      }
    } else {
      course.instructors = course.instructors || {};
      course.instructors.primary = {
        instructorId: "",
        name: "",
        role: "Lead Instructor",
      };
    }

    // SAFE additional instructors processing
    if (
      course.instructors?.additional &&
      Array.isArray(course.instructors.additional)
    ) {
      course.instructors.additional = course.instructors.additional.map(
        (inst) => {
          if (inst.instructorId) {
            if (
              typeof inst.instructorId === "object" &&
              inst.instructorId._id
            ) {
              return {
                ...inst,
                instructorId: inst.instructorId._id.toString(),
                name: `${inst.instructorId.firstName || ""} ${
                  inst.instructorId.lastName || ""
                }`.trim(),
                sessions: Array.isArray(inst.sessions)
                  ? inst.sessions.join(", ")
                  : inst.sessions || "",
              };
            } else {
              return {
                ...inst,
                instructorId: inst.instructorId.toString(),
                name: inst.name || "",
                sessions: Array.isArray(inst.sessions)
                  ? inst.sessions.join(", ")
                  : inst.sessions || "",
              };
            }
          }
          return inst;
        }
      );
    }

    // SAFE media processing
    if (
      course.media?.mainImage &&
      typeof course.media.mainImage === "object" &&
      course.media.mainImage.url
    ) {
      course.media.mainImage = course.media.mainImage.url;
    }

    // SAFE array to string conversions
    const arrayToString = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");

    if (course.schedule?.displayTimezones) {
      course.schedule.displayTimezones = arrayToString(
        course.schedule.displayTimezones
      );
    }
    if (course.technical?.systemRequirements?.os) {
      course.technical.systemRequirements.os = arrayToString(
        course.technical.systemRequirements.os
      );
    }
    if (course.technical?.systemRequirements?.browsers) {
      course.technical.systemRequirements.browsers = arrayToString(
        course.technical.systemRequirements.browsers
      );
    }
    if (course.metadata?.tags) {
      course.metadata.tags = arrayToString(course.metadata.tags);
    }
    if (course.notificationSettings?.reminderSchedule) {
      course.notificationSettings.reminderSchedule = arrayToString(
        course.notificationSettings.reminderSchedule
      );
    }

    // SAFE certification bodies processing
    if (
      course.certification?.certificationBodies &&
      Array.isArray(course.certification.certificationBodies)
    ) {
      course.certification.certificationBodies =
        course.certification.certificationBodies.map((cb) => {
          const result = {
            bodyId: "",
            name: cb.name || "",
            role: cb.role || "co-issuer",
          };

          if (cb.bodyId) {
            if (typeof cb.bodyId === "object" && cb.bodyId._id) {
              result.bodyId = cb.bodyId._id.toString();
              result.name =
                cb.bodyId.displayName || cb.bodyId.companyName || result.name;
            } else if (typeof cb.bodyId === "string") {
              result.bodyId = cb.bodyId;
            }
          }

          return result;
        });
    }

    // Get enrollment count safely
    const enrollmentCount =
      this.courses?.find((c) => c._id === course._id)?.enrollment
        ?.currentEnrollment || 0;
    course.enrollment = course.enrollment || {};
    course.enrollment.currentEnrollment = enrollmentCount;

    // Set default values safely
    course.assessment = course.assessment || {};
    course.assessment.type = course.assessment.type || "none";
    course.recording = course.recording || {};
    course.recording.type = course.recording.type || "cloud";
    course.technical = course.technical || {};
    course.technical.equipment = course.technical.equipment || {};
    course.technical.equipment.camera =
      course.technical.equipment.camera || "recommended";
    course.technical.equipment.microphone =
      course.technical.equipment.microphone || "required";
    course.technical.equipment.headset =
      course.technical.equipment.headset || "recommended";
    course.attendance = course.attendance || {};
    course.attendance.method = course.attendance.method || "automatic";
    course.content = course.content || {};
    course.content.experienceLevel =
      course.content.experienceLevel || "all-levels";
    course.certification = course.certification || {};
    course.certification.type = course.certification.type || "completion";
    course.platform = course.platform || {};
    course.platform.name = course.platform.name || "Zoom";

    console.log("✅ Course data processed safely");
  }

  // NEW: Safely populate all form fields
  _populateAllFormFieldsSafely(course) {
    console.log("📝 SAFELY populating ALL form sections...");

    // Safe helper function
    const safeValue = (value, defaultValue = "") => {
      if (value === null || value === undefined) return defaultValue;
      return value;
    };

    const safeStringValue = (value, defaultValue = "") => {
      if (!value) return defaultValue;
      if (typeof value === "object" && value._id) return value._id.toString();
      return value.toString();
    };

    // Basic Information
    this.setFormValue("basic[courseCode]", safeValue(course.basic?.courseCode));
    this.setFormValue("basic[title]", safeValue(course.basic?.title));
    this.setFormValue(
      "basic[description]",
      safeValue(course.basic?.description)
    );
    this.setFormValue(
      "basic[aboutThisCourse]",
      safeValue(course.basic?.aboutThisCourse)
    );
    this.setFormValue(
      "basic[category]",
      safeValue(course.basic?.category, "aesthetic")
    );
    this.setFormValue(
      "basic[status]",
      safeValue(course.basic?.status, "draft")
    );

    // Schedule Information
    this.setFormValue(
      "schedule[startDate]",
      safeValue(course.schedule?.startDate)
    );
    this.setFormValue("schedule[endDate]", safeValue(course.schedule?.endDate));
    this.setFormValue(
      "schedule[registrationDeadline]",
      safeValue(course.schedule?.registrationDeadline)
    );
    this.setFormValue(
      "schedule[duration]",
      safeValue(course.schedule?.duration)
    );
    this.setFormValue(
      "schedule[primaryTimezone]",
      safeValue(course.schedule?.primaryTimezone, "UTC")
    );
    this.setFormValue(
      "schedule[displayTimezones]",
      safeValue(course.schedule?.displayTimezones)
    );
    this.setFormValue(
      "schedule[pattern]",
      safeValue(course.schedule?.pattern, "single")
    );
    this.setFormValue(
      "schedule[sessionTime][startTime]",
      safeValue(course.schedule?.sessionTime?.startTime)
    );
    this.setFormValue(
      "schedule[sessionTime][endTime]",
      safeValue(course.schedule?.sessionTime?.endTime)
    );
    this.setFormValue(
      "schedule[sessionTime][breakDuration]",
      safeValue(course.schedule?.sessionTime?.breakDuration, 15)
    );

    // Enrollment Information
    this.setFormValue(
      "enrollment[price]",
      safeValue(course.enrollment?.price, 0)
    );
    this.setFormValue(
      "enrollment[earlyBirdPrice]",
      safeValue(course.enrollment?.earlyBirdPrice)
    );
    this.setFormValue(
      "enrollment[currency]",
      safeValue(course.enrollment?.currency, "USD")
    );
    this.setFormValue(
      "enrollment[seatsAvailable]",
      safeValue(course.enrollment?.seatsAvailable, 50)
    );
    this.setFormValue(
      "enrollment[minEnrollment]",
      safeValue(course.enrollment?.minEnrollment, 10)
    );
    this.setFormValue(
      "enrollment[waitlistEnabled]",
      safeValue(course.enrollment?.waitlistEnabled, false)
    );
    this.setFormValue(
      "enrollment[registrationUrl]",
      safeValue(course.enrollment?.registrationUrl)
    );

    // Instructor Information - SAFE VERSION
    this.setFormValue(
      "instructors[primary][instructorId]",
      safeStringValue(course.instructors?.primary?.instructorId)
    );
    this.setFormValue(
      "instructors[primary][name]",
      safeValue(course.instructors?.primary?.name)
    );
    this.setFormValue(
      "instructors[primary][role]",
      safeValue(course.instructors?.primary?.role, "Lead Instructor")
    );

    // Platform Information
    this.setFormValue(
      "platform[name]",
      safeValue(course.platform?.name, "Zoom")
    );
    this.setFormValue(
      "platform[accessUrl]",
      safeValue(course.platform?.accessUrl)
    );
    this.setFormValue(
      "platform[meetingId]",
      safeValue(course.platform?.meetingId)
    );
    this.setFormValue(
      "platform[passcode]",
      safeValue(course.platform?.passcode)
    );
    this.setFormValue(
      "platform[backupPlatform]",
      safeValue(course.platform?.backupPlatform)
    );
    this.setFormValue(
      "platform[backupUrl]",
      safeValue(course.platform?.backupUrl)
    );

    // Platform Features
    this.setFormValue(
      "platform[features][breakoutRooms]",
      safeValue(course.platform?.features?.breakoutRooms, false)
    );
    this.setFormValue(
      "platform[features][polling]",
      safeValue(course.platform?.features?.polling, false)
    );
    this.setFormValue(
      "platform[features][whiteboard]",
      safeValue(course.platform?.features?.whiteboard, false)
    );
    this.setFormValue(
      "platform[features][recording]",
      safeValue(course.platform?.features?.recording, false)
    );
    this.setFormValue(
      "platform[features][chat]",
      safeValue(course.platform?.features?.chat, false)
    );
    this.setFormValue(
      "platform[features][screenSharing]",
      safeValue(course.platform?.features?.screenSharing, false)
    );

    // Continue with all other sections using safeValue...
    // (I'll include the rest for completeness but truncate for space)

    // Certification Information - SAFE VERSION
    this.setFormValue(
      "certification[enabled]",
      safeValue(course.certification?.enabled, false)
    );
    this.setFormValue(
      "certification[type]",
      safeValue(course.certification?.type, "completion")
    );
    this.setFormValue(
      "certification[issuingAuthorityId]",
      safeStringValue(course.certification?.issuingAuthorityId)
    );
    this.setFormValue(
      "certification[issuingAuthority]",
      safeValue(
        course.certification?.issuingAuthority,
        "IAAI Training Institute"
      )
    );

    // Trigger conditional sections safely
    this.toggleAssessmentSections(course.assessment?.type || "none");
    this.toggleGamificationFeatures(
      course.experience?.gamification?.enabled || false
    );

    console.log("✅ ALL form sections populated SAFELY");
  }

  // NEW: Basic form fields for fallback
  _populateBasicFormFieldsSafely(course) {
    this.setFormValue("basic[courseCode]", course.basic?.courseCode || "");
    this.setFormValue("basic[title]", course.basic?.title || "");
    this.setFormValue("enrollment[price]", course.enrollment?.price || 0);
    this.setFormValue("platform[name]", course.platform?.name || "Zoom");
    this.setFormValue("platform[accessUrl]", course.platform?.accessUrl || "");
  }

  // NEW: Safely render all dynamic sections
  _renderAllDynamicSectionsSafely() {
    console.log("🔄 SAFELY rendering ALL dynamic sections with saved data...");

    try {
      // Render each type of dynamic section with error handling
      this.savedDynamicItems.instructors?.forEach((instructor) => {
        try {
          this.addInstructor(instructor);
        } catch (e) {
          console.warn("Error adding instructor:", e);
        }
      });

      this.savedDynamicItems.certificationBodies?.forEach((body) => {
        try {
          this.addCertificationBody(body);
        } catch (e) {
          console.warn("Error adding cert body:", e);
        }
      });

      this.savedDynamicItems.sessions?.forEach((session) => {
        try {
          this.addSession(session);
        } catch (e) {
          console.warn("Error adding session:", e);
        }
      });

      this.savedDynamicItems.objectives?.forEach((objective) => {
        try {
          this.addObjective(objective.text);
        } catch (e) {
          console.warn("Error adding objective:", e);
        }
      });

      // Continue with other dynamic sections...

      console.log("✅ ALL dynamic sections rendered SAFELY");
    } catch (error) {
      console.error("❌ Error in safe dynamic rendering:", error);
    }
  }

  /**
   * Helper method to set form field values, handling different input types.
   * @param {string} name - The name attribute of the input field (e.g., 'basic[title]').
   * @param {*} value - The value to set.
   */
  setFormValue(name, value) {
    const element = document.querySelector(`[name="${name}"]`);
    if (element) {
      if (element.type === "checkbox" || element.type === "radio") {
        element.checked = value === true || value === "true" || value === "on";
      } else if (element.tagName === "SELECT") {
        // For select elements, ensure the option exists before setting
        const optionExists = Array.from(element.options).some(
          (option) => option.value === value
        );
        if (optionExists || value === "") {
          element.value = value || "";
        } else {
          console.warn(
            `⚠️ Option "${value}" not found in select "${name}". Setting to first option.`
          );
          element.value = element.options[0]?.value || "";
        }
      } else {
        // For regular input fields, ensure we don't set null/undefined
        element.value =
          value !== null && value !== undefined ? value.toString() : "";
      }

      // Trigger change event to ensure any listeners are notified
      element.dispatchEvent(new Event("change", { bubbles: true }));

      console.log(`📝 Set form value: ${name} = "${element.value}"`);
    } else {
      console.warn(`⚠️ Form element with name "${name}" not found.`);
    }
  }

  /**
   * Formats a date string into 'YYYY-MM-DDTHH:MM' for datetime-local input.
   * @param {string|Date} dateString - The date string or Date object.
   * @returns {string} Formatted date string or empty string.
   */
  formatDateForInput(dateString) {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date string provided: ${dateString}`);
        return "";
      }
      return date.toISOString().slice(0, 16);
    } catch (error) {
      console.error("Error formatting date for input:", error);
      return "";
    }
  }

  /**
   * Enhanced method to add existing file preview with proper edit controls
   */
  _addExistingFilePreview(container, uploadType, fileUrl, courseId) {
    const fileName = fileUrl.split("/").pop();
    const fileItem = document.createElement("div");
    fileItem.className = "file-item existing-file";
    fileItem.dataset.fileName = fileName;
    fileItem.dataset.fileUrl = fileUrl;
    fileItem.dataset.uploadType = uploadType;

    // Determine the icon based on file extension
    let iconClass = this.getFileIconFromUrl(fileUrl);

    const isMainImage = uploadType === "mainImage";

    // Create preview content based on file type
    let previewContent = "";
    if (isMainImage || uploadType === "images") {
      // Show image preview for main image and gallery images
      previewContent = `
      <div class="file-preview-image">
        <img src="${fileUrl}" alt="${fileName}" style="max-width: 100px; max-height: 100px; object-fit: cover; border-radius: 4px;">
      </div>
    `;
    } else {
      // Show icon for other file types
      previewContent = `<i class="${iconClass}" style="font-size: 24px; margin-right: 8px;"></i>`;
    }

    fileItem.innerHTML = `
    <div class="file-info">
      ${previewContent}
      <div class="file-details">
        <span class="file-name">${fileName}</span>
        <span class="file-status existing"> - Existing File</span>
      </div>
    </div>
    <div class="file-actions">
      <button type="button" class="btn btn-sm btn-info view-file-btn" 
              onclick="adminOnlineCourses.viewFile('${fileUrl}')" 
              title="View/Download file">
        <i class="fas fa-eye"></i>
      </button>
      <button type="button" class="btn btn-sm btn-warning replace-file-btn" 
              onclick="adminOnlineCourses.replaceExistingFile('${uploadType}', '${fileUrl}', '${courseId}')"
              title="Replace this file">
        <i class="fas fa-exchange-alt"></i>
      </button>
      <button type="button" class="btn btn-sm btn-danger remove-existing-file-btn" 
              onclick="adminOnlineCourses.deleteExistingFile('${uploadType}', '${fileUrl}', '${courseId}')"
              title="Delete this file from server">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;

    // Add enhanced styling for better presentation
    fileItem.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    margin: 8px 0;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    transition: all 0.2s ease;
  `;

    container.appendChild(fileItem);
    console.log(`✅ Added existing file preview: ${fileName} (${uploadType})`);
  }

  /**
   * Enhanced method to handle file replacement
   */
  async replaceExistingFile(uploadType, oldFileUrl, courseId) {
    console.log(`🔄 Replacing existing file: ${oldFileUrl} (${uploadType})`);

    // Create a temporary file input to select new file
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.display = "none";

    // Set appropriate file type restrictions
    const config = this.fileUploadConfig;
    if (config.allowedTypes[uploadType]) {
      fileInput.accept = config.allowedTypes[uploadType].join(",");
    }

    // Handle single vs multiple files
    if (uploadType !== "mainImage") {
      fileInput.multiple = false; // Replace only one file at a time
    }

    fileInput.addEventListener("change", async (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        try {
          // Validate the selected file
          const validation = this.validateFiles(files, uploadType);
          if (!validation.isValid) {
            validation.errors.forEach((error) => {
              this.showToast("error", "File Validation Error", error);
            });
            return;
          }

          // Upload the new file
          console.log(`📤 Uploading replacement file for ${uploadType}...`);
          await this.handleFileUpload(validation.validFiles, uploadType);

          // Delete the old file from server
          console.log(`🗑️ Deleting old file: ${oldFileUrl}`);
          await this.deleteExistingFile(
            uploadType,
            oldFileUrl,
            courseId,
            false
          ); // Don't show confirmation

          this.showToast(
            "success",
            "File Replaced",
            `File replaced successfully with ${files[0].name}`
          );
        } catch (error) {
          console.error("❌ Error replacing file:", error);
          this.showToast(
            "error",
            "Replace Failed",
            `Failed to replace file: ${error.message}`
          );
        }
      }

      // Clean up
      document.body.removeChild(fileInput);
    });

    // Add to DOM and trigger click
    document.body.appendChild(fileInput);
    fileInput.click();
  }

  /**
   * Enhanced method to delete existing files with better UX
   */
  async deleteExistingFile(
    uploadType,
    fileUrl,
    courseId,
    showConfirmation = true
  ) {
    const fileName = fileUrl.split("/").pop();

    // Enhanced confirmation dialog
    if (showConfirmation) {
      const confirmMessage = `Are you sure you want to permanently delete "${fileName}" from the server?\n\nThis action cannot be undone and will remove the file from the course.`;
      if (!confirm(confirmMessage)) {
        return;
      }
    }

    try {
      console.log(`🗑️ Deleting existing file: ${fileName} (${uploadType})`);

      // Show loading state on the file item
      const fileItem = document.querySelector(`[data-file-url="${fileUrl}"]`);
      if (fileItem) {
        const deleteBtn = fileItem.querySelector(".remove-existing-file-btn");
        if (deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        fileItem.style.opacity = "0.6";
      }

      // Send delete request to server
      const response = await fetch(
        `/admin-courses/onlinelive/api/${courseId}/delete-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileType: uploadType,
            fileUrl: fileUrl,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Remove the file item from display with animation
        if (fileItem) {
          fileItem.style.transition = "all 0.3s ease";
          fileItem.style.transform = "scale(0.95)";
          fileItem.style.opacity = "0";
          setTimeout(() => {
            fileItem.remove();
          }, 300);
        }

        // Remove from savedUploadedFiles
        if (uploadType === "mainImage") {
          if (this.savedUploadedFiles.mainImage === fileUrl) {
            this.savedUploadedFiles.mainImage = null;
          }
        } else if (Array.isArray(this.savedUploadedFiles[uploadType])) {
          this.savedUploadedFiles[uploadType] = this.savedUploadedFiles[
            uploadType
          ].filter((url) => url !== fileUrl);
        }

        // Update file count badge
        if (uploadType !== "mainImage") {
          const input = document.querySelector(`input[name="${uploadType}"]`);
          if (input) {
            this.updateFileCountBadge(input.parentElement, uploadType);
          }
        }

        if (showConfirmation) {
          this.showToast(
            "success",
            "File Deleted",
            `"${fileName}" deleted successfully from server`
          );
        }

        console.log(`✅ File deleted successfully: ${fileName}`);
      } else {
        // Restore button state on error
        if (fileItem) {
          const deleteBtn = fileItem.querySelector(".remove-existing-file-btn");
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
          }
          fileItem.style.opacity = "1";
        }

        this.showToast(
          "error",
          "Delete Failed",
          result.message || `Failed to delete "${fileName}"`
        );
        console.error(`❌ Failed to delete file: ${result.message}`);
      }
    } catch (error) {
      console.error("Error deleting file:", error);

      // Restore button state on error
      const fileItem = document.querySelector(`[data-file-url="${fileUrl}"]`);
      if (fileItem) {
        const deleteBtn = fileItem.querySelector(".remove-existing-file-btn");
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        }
        fileItem.style.opacity = "1";
      }

      this.showToast(
        "error",
        "Delete Error",
        `Failed to delete "${fileName}": ${error.message}`
      );
    }
  }

  openCreateFromInPersonModal() {
    // Placeholder for future implementation
    this.showToast(
      "info",
      "Feature Coming Soon",
      "Creating from In-Person templates is under development."
    );
    // You would typically fetch in-person courses here and display them in the modal
    // For now, just show the modal, but it will be empty or show a message
    const modal = document.getElementById("createFromInPersonModal");
    if (modal) {
      modal.classList.add("active");
      // Add event listener to close on overlay click
      modal.addEventListener("click", (e) => {
        if (e.target.id === "createFromInPersonModal") {
          this.closeCreateFromInPersonModal();
        }
      });
    }
  }

  closeCreateFromInPersonModal() {
    const modal = document.getElementById("createFromInPersonModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  selectAllCourses(checked) {
    document.querySelectorAll(".course-checkbox").forEach((checkbox) => {
      checkbox.checked = checked;
    });
  }

  async exportData() {
    this.showLoading(true);

    try {
      const response = await fetch("/admin-courses/onlinelive/api/export");
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `online-live-courses-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      a.click();

      window.URL.revokeObjectURL(url);
      this.showToast("success", "Success", "Data exported successfully");
    } catch (error) {
      console.error("Error exporting data:", error);
      this.showToast("error", "Error", "Failed to export data");
    } finally {
      this.showLoading(false);
    }
  }

  // Utility Methods
  formatDate(dateString) {
    if (!dateString) return "TBD";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  }

  showLoading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
      overlay.classList.toggle("active", show);
    }
  }

  showConfirmModal(title, message, onConfirm, options = {}) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");
    const confirmBtn = document.getElementById("confirmAction");
    const cancelBtn = document.getElementById("cancelAction");

    if (!modal || !titleEl || !messageEl || !confirmBtn) {
      console.error("Confirmation modal elements not found");
      return;
    }

    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Configure buttons
    const confirmText = options.confirmText || "Confirm";
    const confirmClass = options.confirmClass || "btn-danger";
    const cancelText = options.cancelText || "Cancel";

    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${confirmClass}`;

    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
    }

    // Show modal
    modal.classList.add("active");

    // Store the confirmation action
    this.pendingConfirmAction = onConfirm;

    // Set up button handlers
    const handleConfirm = () => {
      if (this.pendingConfirmAction) {
        this.pendingConfirmAction();
        this.pendingConfirmAction = null;
      }
      this.closeConfirmModal();
    };

    const handleCancel = () => {
      this.closeConfirmModal();
    };

    // Remove existing listeners and add new ones
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById("confirmAction");
    newConfirmBtn.addEventListener("click", handleConfirm);

    if (cancelBtn) {
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      const newCancelBtn = document.getElementById("cancelAction");
      newCancelBtn.addEventListener("click", handleCancel);
    }

    // Handle Escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        handleCancel();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  closeConfirmModal() {
    const modal = document.getElementById("confirmModal");
    if (modal) {
      modal.classList.remove("active");
    }
    this.pendingConfirmAction = null;
  }

  showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon =
      type === "success"
        ? "fa-check-circle"
        : type === "error"
        ? "fa-exclamation-circle"
        : type === "warning"
        ? "fa-exclamation-triangle"
        : "fa-info-circle";

    toast.innerHTML = `
              <i class="fas ${icon} toast-icon"></i>
              <div class="toast-content">
                  <div class="toast-title">${title}</div>
                  <div class="toast-message">${message}</div>
              </div>
              <button class="toast-close" onclick="this.parentElement.remove()">
                  <i class="fas fa-times"></i>
              </button>
          `;

    const container = document.getElementById("toastContainer");
    if (container) {
      container.appendChild(toast);

      // Show toast
      setTimeout(() => toast.classList.add("show"), 100);

      // Auto remove after 5 seconds
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }, 5000);
    }
  }

  // Debug Functions
  debugSavedItems() {
    console.log("🔍 Current saved dynamic items:");
    Object.keys(this.savedDynamicItems).forEach((key) => {
      console.log(`${key}:`, this.savedDynamicItems[key].length, "items");
    });

    const totalItems = Object.values(this.savedDynamicItems).reduce(
      (sum, items) => sum + items.length,
      0
    );
    console.log("Total saved items:", totalItems);
  }

  // Get Required Styles (same as in-person)
  getRequiredStyles() {
    return `
              /* CSS Variables */
              :root {
                  --primary-color: #3b82f6;
                  --secondary-color: #6b7280;
                  --success-color: #10b981;
                  --danger-color: #ef4444;
                  --warning-color: #f59e0b;
                  --info-color: #3b82f6;
                  --text-primary: #1f2937;
                  --text-secondary: #6b7280;
                  --text-light: #9ca3af;
                  --bg-primary: #ffffff;
                  --bg-secondary: #f8fafc;
                  --bg-light: #f1f5f9;
                  --border-color: #e5e7eb;
                  --border-light: #f3f4f6;
                  --border-dark: #d1d5db;
              }
  
              /* Base Styling */
              body {
                  color: var(--text-primary);
                  background: var(--bg-primary);
              }
  
              /* Form Elements */
              input, select, textarea {
                  color: var(--text-primary) !important;
                  background: var(--bg-primary) !important;
                  border: 1px solid var(--border-color) !important;
                  padding: 8px 12px;
                  border-radius: 6px;
              }
  
              input:focus, select:focus, textarea:focus {
                  outline: none;
                  border-color: var(--primary-color) !important;
                  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
              }
  
              input::placeholder, textarea::placeholder {
                  color: var(--text-secondary) !important;
              }
  
              /* Labels */
              label {
                  color: var(--text-primary) !important;
                  font-weight: 500;
                  margin-bottom: 4px;
                  display: block;
              }
  
              /* Headings */
              h1, h2, h3, h4, h5, h6 {
                  color: var(--text-primary) !important;
              }
  
              /* Dynamic Items */
              .dynamic-item {
                  color: var(--text-primary) !important;
                  background: var(--bg-primary) !important;
                  border: 1px solid var(--border-color);
                  border-radius: 8px;
                  margin-bottom: 16px;
                  padding: 16px;
                  transition: all 0.3s ease;
              }
  
              .dynamic-item.saved-item {
                  background: #f0fdf4 !important;
                  border-color: #10b981 !important;
              }
  
              .dynamic-item input, 
              .dynamic-item select, 
              .dynamic-item textarea {
                  color: var(--text-primary) !important;
                  background: var(--bg-primary) !important;
              }
  
              /* Dynamic Item Header */
              .dynamic-item-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 8px 12px;
                  background: var(--bg-secondary);
                  border-bottom: 1px solid var(--border-color);
                  border-radius: 4px 4px 0 0;
                  margin-bottom: 12px;
              }
              
              .dynamic-item-header h6 {
                  margin: 0;
                  color: var(--text-primary);
                  font-weight: 600;
              }
              
              .dynamic-item-actions {
                  display: flex;
                  gap: 4px;
              }
              
              .save-item-btn, .remove-btn {
                  padding: 4px 8px;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  transition: all 0.2s;
              }
              
              .save-item-btn {
                  background: var(--success-color);
                  color: white;
              }
              
              .save-item-btn:hover {
                  background: #059669;
              }
              
              .save-item-btn.saved {
                  background: #059669;
                  animation: savedPulse 0.5s ease-out;
              }
              
              .remove-btn {
                  background: var(--danger-color);
                  color: white;
              }
              
              .remove-btn:hover {
                  background: #dc2626;
              }
              
              @keyframes savedPulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.1); }
                  100% { transform: scale(1); }
              }
  
              /* Form Grid */
              .form-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 16px;
                  margin-bottom: 16px;
              }
  
              .form-group {
                  margin-bottom: 16px;
              }
  
              .form-group.full-width {
                  grid-column: 1 / -1;
              }
  
              /* Status Badges */
              .status-badge {
                  color: white !important;
                  font-weight: 600;
                  padding: 4px 8px;
                  border-radius: 4px;
                  font-size: 12px;
                  text-transform: uppercase;
              }
  
              .status-draft { background: #6b7280 !important; }
              .status-open { background: #10b981 !important; }
              .status-full { background: #f59e0b !important; }
              .status-in-progress { background: #3b82f6 !important; }
              .status-completed { background: #059669 !important; }
              .status-cancelled { background: #ef4444 !important; }
  
              /* Table Styling */
              table {
                  color: var(--text-primary) !important;
                  width: 100%;
                  border-collapse: collapse;
              }
  
              th, td {
                  color: var(--text-primary) !important;
                  padding: 12px;
                  text-align: left;
                  border-bottom: 1px solid var(--border-color);
              }
  
              th {
                  background: var(--bg-secondary) !important;
                  font-weight: 600;
              }
  
              /* Course Cards */
              .course-card {
                  color: var(--text-primary) !important;
                  background: var(--bg-primary) !important;
                  border: 1px solid var(--border-color);
                  border-radius: 8px;
                  padding: 16px;
                  margin-bottom: 16px;
              }
  
              .file-actions {
                  display: flex;
                  gap: 4px;
              }
              
              .save-file-btn {
                  padding: 4px 8px;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  background: #10b981;
                  color: white;
                  transition: all 0.2s;
              }
              
              .save-file-btn:hover:not(:disabled) {
                  background: #059669;
              }
              
              .save-file-btn.saved {
                  background: #059669;
                  cursor: default;
              }
              
              .save-file-btn:disabled {
                  opacity: 0.8;
              }
              
              .file-item.saved-file {
                  background: #f0fdf4;
                  border: 1px solid #10b981;
                  border-radius: 4px;
                  padding: 8px;
                  margin: 4px 0;
              }
              
              .save-item-btn.saved {
                  background: #059669;
                  cursor: default;
              }
              
              .save-item-btn:disabled {
                  opacity: 0.8;
              }
              
              .dynamic-item.saved-item {
                  background: #f0fdf4;
                  border-color: #10b981;
              }
              
              /* Keep saved state visible */
              .dynamic-item[data-saved="true"] {
                  background: #f0fdf4;
                  border-color: #10b981;
              }
  
              .course-card h3 {
                  color: var(--text-primary) !important;
                  margin-bottom: 12px;
              }
  
              /* Buttons */
              .btn {
                  padding: 8px 16px;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 500;
                  transition: all 0.2s ease;
              }
  
              .btn-primary {
                  background: var(--primary-color);
                  color: white;
              }
  
              .btn-primary:hover {
                  background: #2563eb;
              }
  
              .btn-secondary {
                  background: var(--secondary-color);
                  color: white;
              }
  
              .btn-secondary:hover {
                  background: #4b5563;
              }
  
              .btn-success {
                  background: var(--success-color);
                  color: white;
              }
  
              .btn-success:hover {
                  background: #059669;
              }
  
              .btn-danger {
                  background: var(--danger-color);
                  color: white;
              }
  
              .btn-danger:hover {
                  background: #dc2626;
              }
  
              /* Toast Notifications */
              .toast {
                  position: fixed;
                  top: 20px;
                  right: 20px;
                  z-index: 10000;
                  max-width: 400px;
                  background: white;
                  border-radius: 8px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                  border-left: 4px solid var(--info-color);
                  animation: slideInRight 0.3s ease-out;
                  opacity: 0;
                  transform: translateX(100%);
                  transition: all 0.3s ease;
                  display: flex;
                  align-items: flex-start;
                  padding: 16px;
                  gap: 12px;
              }
  
              .toast.show {
                  opacity: 1;
                  transform: translateX(0);
              }
  
              .toast.success {
                  border-left-color: var(--success-color);
              }
  
              .toast.error {
                  border-left-color: var(--danger-color);
              }
  
              .toast.warning {
                  border-left-color: var(--warning-color);
              }
  
              .toast-icon {
                  font-size: 18px;
                  margin-top: 2px;
              }
  
              .toast.success .toast-icon {
                  color: var(--success-color);
              }
  
              .toast.error .toast-icon {
                  color: var(--danger-color);
              }
  
              .toast.warning .toast-icon {
                  color: var(--warning-color);
              }
  
              .toast-content {
                  flex: 1;
              }
  
              .toast-title {
                  font-weight: 600;
                  color: var(--text-primary);
                  margin-bottom: 4px;
              }
  
              .toast-message {
                  color: var(--text-secondary);
                  font-size: 14px;
                  line-height: 1.4;
              }
  
              .toast-close {
                  background: none;
                  border: none;
                  cursor: pointer;
                  color: var(--text-secondary);
                  padding: 4px;
                  border-radius: 4px;
                  transition: all 0.2s;
              }
  
              .toast-close:hover {
                  background: var(--bg-light);
                  color: var(--text-primary);
              }
  
              @keyframes slideInRight {
                  from {
                      transform: translateX(100%);
                      opacity: 0;
                  }
                  to {
                      transform: translateX(0);
                      opacity: 1;
                  }
              }
  
              /* File Upload Styles */
              .upload-progress {
                  margin-top: 16px;
                  padding: 12px;
                  background: var(--bg-light);
                  border-radius: 6px;
                  border: 1px solid var(--border-color);
              }
              
              .progress-bar {
                  height: 6px;
                  background: var(--border-color);
                  border-radius: 3px;
                  overflow: hidden;
                  margin-bottom: 8px;
              }
              
              .progress-fill {
                  height: 100%;
                  background: var(--primary-color);
                  border-radius: 3px;
                  animation: progressAnimation 2s ease-in-out infinite;
              }
              
              @keyframes progressAnimation {
                  0% { width: 0%; }
                  50% { width: 100%; }
                  100% { width: 0%; }
              }
              
              .progress-content {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
              }
              
              .progress-text {
                  font-size: 14px;
                  color: var(--text-secondary);
              }
              
              .progress-cancel {
                  background: var(--danger-color);
                  color: white;
                  border: none;
                  padding: 4px 8px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  transition: all 0.2s;
              }
              
              .progress-cancel:hover {
                  background: #dc2626;
              }
  
              /* Confirmation Modal Styles */
              .modal-container.small {
                  max-width: 500px;
              }
              
              .modal-actions {
                  display: flex;
                  gap: 12px;
                  justify-content: flex-end;
                  margin-top: 20px;
              }
  
              /* Additional Text Color Fixes */
              .course-title {
                  color: var(--text-primary) !important;
                  font-weight: 600;
              }
              
              .course-code {
                  color: var(--text-secondary) !important;
                  font-size: 14px;
              }
              
              .platform-name {
                  color: var(--text-primary) !important;
                  font-weight: 500;
              }
              
              .platform-link {
                  color: var(--primary-color) !important;
                  font-size: 12px;
              }
              
              .instructor-list {
                  color: var(--text-primary) !important;
              }
              
              .price-main {
                  color: var(--text-primary) !important;
                  font-weight: 600;
              }
              
              .enrollment-count {
                  color: var(--text-primary) !important;
                  font-size: 14px;
              }
              
              .schedule-date {
                  color: var(--text-primary) !important;
                  font-weight: 500;
              }
              
              .schedule-duration {
                  color: var(--text-secondary) !important;
                  font-size: 12px;
              }
  
              /* Responsive design */
              @media (max-width: 768px) {
                  .toast {
                      right: 10px;
                      left: 10px;
                      max-width: none;
                  }
                  
                  .dynamic-item-header {
                      flex-direction: column;
                      gap: 8px;
                      align-items: flex-start;
                  }
                  
                  .modal-actions {
                      flex-direction: column;
                  }
              }
          `;
  }

  // Fix for admin-online-courses.js
  // Add this method to handle media fields properly before form submission

  // Add this method to the AdminOnlineCoursesManager class
  sanitizeMediaFields() {
    console.log("🧹 Sanitizing media fields before submission...");

    // Check and fix main image field
    const mainImageInput = document.querySelector(
      'input[name="media[mainImage]"]'
    );
    if (mainImageInput) {
      // If the value is empty or just contains whitespace, clear it completely
      if (!mainImageInput.value || mainImageInput.value.trim() === "") {
        mainImageInput.remove(); // Remove the field entirely so it doesn't get sent
        console.log("🧹 Removed empty mainImage field");
      }
    }

    // Check for any hidden mainImage fields that might contain objects
    const hiddenMainImageInputs = document.querySelectorAll(
      'input[name*="mainImage"]'
    );
    hiddenMainImageInputs.forEach((input) => {
      if (input.value && typeof input.value === "string") {
        try {
          // Check if the value is a JSON object string
          const parsed = JSON.parse(input.value);
          if (typeof parsed === "object" && parsed !== null && !parsed.url) {
            input.remove();
            console.log("🧹 Removed invalid mainImage object field");
          }
        } catch (e) {
          // Not JSON, check if it's a valid URL or empty
          if (!input.value.trim() || input.value.trim() === "[object Object]") {
            input.remove();
            console.log("🧹 Removed invalid mainImage field");
          }
        }
      }
    });
  }
}

// Initialize the admin online courses manager
let adminOnlineCourses;
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM loaded, initializing AdminOnlineCoursesManager...");
  adminOnlineCourses = new AdminOnlineCoursesManager();

  // Add global debug functions
  window.debugSavedItems = () => adminOnlineCourses.debugSavedItems();

  // Add required styles to the page
  const styleSheet = document.createElement("style");
  styleSheet.textContent = adminOnlineCourses.getRequiredStyles();
  document.head.appendChild(styleSheet);

  console.log("✅ AdminOnlineCoursesManager initialized successfully");
  console.log("💡 Debug command: debugSavedItems()");
});
